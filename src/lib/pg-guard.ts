import "./postgres-url";
import { Client, Pool, type PoolClient } from "pg";

type PgLast = { code?: string };
const globalPg = globalThis as typeof globalThis & { __mmPgLast?: PgLast };

function remember(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") globalPg.__mmPgLast = { code };
  }
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

export function lastPgCode(): string | undefined {
  return globalPg.__mmPgLast?.code;
}
