import "./postgres-url";
import { Client, Pool, type PoolClient } from "pg";

type PgLast = { code?: string };
const globalPg = globalThis as typeof globalThis & { __mmPgLast?: PgLast };

function remember(error: unknown) {
  if (!error || typeof error !== "object") return;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "string") globalPg.__mmPgLast = { code };
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

const originalClientConnect = Client.prototype.connect as (
  this: Client,
  callback?: (error?: Error) => void,
) => unknown;
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

const originalConnect = Pool.prototype.connect as (...args: unknown[]) => unknown;
Pool.prototype.connect = function connect(this: Pool, ...args: unknown[]) {
  const marked = this as Pool & { __mmErr?: boolean };
  if (!marked.__mmErr) {
    marked.__mmErr = true;
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

export function clearPgCode(): void {
  globalPg.__mmPgLast = undefined;
}

export function lastPgCode(): string | undefined {
  return globalPg.__mmPgLast?.code;
}
