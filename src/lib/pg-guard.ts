import { ensureDatabaseUrl } from "./postgres-url";
import { Client, Pool, type PoolClient } from "pg";

type PgLast = { code?: string; hint?: string };
const globalPg = globalThis as typeof globalThis & { __mmPgLast?: PgLast };

function sanitize(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[url]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/password[=:][^\s]+/gi, "password=[redacted]")
    .slice(0, 180);
}

function remember(error: unknown) {
  if (typeof error === "string") {
    globalPg.__mmPgLast = { hint: sanitize(error) };
    return;
  }
  if (!error || typeof error !== "object") return;
  const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
  const message = "message" in error && typeof (error as { message?: unknown }).message === "string"
    ? sanitize((error as { message: string }).message)
    : undefined;
  if (code || message) globalPg.__mmPgLast = { code, hint: message };
  if ("cause" in error && (error as { cause?: unknown }).cause) remember((error as { cause?: unknown }).cause);
}

// The auth pool parses its connection string before this file can rewrite it
// when the bundler evaluates that module first. Force the pooler handshake
// to skip the certificate check on the client that is about to connect.
function loosen(client: Client) {
  const params = (client as Client & { connectionParameters?: { host?: string } }).connectionParameters;
  const host = params?.host || "";
  if (!/supabase/i.test(host)) return;
  const connection = (client as Client & { connection?: { ssl?: true | { rejectUnauthorized?: boolean } } }).connection;
  if (!connection) return;
  if (!connection.ssl || connection.ssl === true) connection.ssl = { rejectUnauthorized: false };
  else connection.ssl.rejectUnauthorized = false;
}

const originalQuery = Client.prototype.query as (...args: unknown[]) => unknown;
const originalClientConnect = Client.prototype.connect as (
  this: Client,
  callback?: (error?: Error) => void,
) => unknown;
const originalConnect = Pool.prototype.connect as (...args: unknown[]) => unknown;

export function installPgGuard(): boolean {
  ensureDatabaseUrl();
  const marked = globalPg as typeof globalPg & { __mmPgGuard?: boolean };
  if (marked.__mmPgGuard) return true;
  marked.__mmPgGuard = true;

  Client.prototype.query = function query(this: Client, ...args: unknown[]) {
    const result = originalQuery.apply(this, args);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<unknown>).catch((error: unknown) => {
        remember(error);
        throw error;
      });
    }
    return result;
  } as typeof Client.prototype.query;

  Client.prototype.connect = function connect(this: Client, callback?: (error?: Error) => void) {
    loosen(this);
    if (typeof callback === "function") {
      return originalClientConnect.call(this, (error?: Error) => {
        if (error) remember(error);
        callback(error);
      });
    }
    const result = originalClientConnect.call(this);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      return (result as Promise<unknown>).catch((error: unknown) => {
        remember(error);
        throw error;
      });
    }
    return result;
  } as typeof Client.prototype.connect;

  Pool.prototype.connect = function connect(this: Pool, ...args: unknown[]) {
    const pool = this as Pool & { __mmErr?: boolean };
    if (!pool.__mmErr) {
      pool.__mmErr = true;
      this.on("error", (error: Error, _client: PoolClient) => {
        remember(error);
        const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "error";
        console.error("[pg] idle client", code);
      });
    }
    return originalConnect.apply(this, args);
  } as typeof Pool.prototype.connect;

  return true;
}

export function clearPgCode(): void {
  globalPg.__mmPgLast = undefined;
}

export function lastPgFailure(): { code?: string; hint?: string } {
  return globalPg.__mmPgLast ?? {};
}
