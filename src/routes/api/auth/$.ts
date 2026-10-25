import { clearPgCode, lastPgFailure } from "@/lib/pg-guard";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});

function sanitize(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[url]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/password[=:][^\s]+/gi, "password=[redacted]")
    .slice(0, 180);
}

async function handleAuth(request: Request): Promise<Response> {
  clearPgCode();
  let hint = "";
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (!hint) {
      for (const arg of args) {
        if (arg instanceof Error && arg.message) hint = sanitize(arg.message);
        else if (arg && typeof arg === "object" && "message" in arg) {
          const message = (arg as { message?: unknown }).message;
          if (typeof message === "string") hint = sanitize(message);
        }
      }
    }
    original(...(args as Parameters<typeof console.error>));
  };
  try {
    const { getSql } = await import("@/lib/db");
    await getSql();
    const response = await auth.handler(request);
    if (response.status < 500) return response;
    const failure = lastPgFailure();
    return Response.json(
      { status: response.status, code: failure.code || "unknown", hint: failure.hint || hint || undefined },
      { status: response.status },
    );
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string; cause?: { code?: string } };
    const failure = lastPgFailure();
    const code = err.code || err.cause?.code || failure.code || err.name || "error";
    console.error("[auth] failed", code);
    return Response.json(
      { status: 500, code, hint: failure.hint || (err.message ? sanitize(err.message) : hint || undefined) },
      { status: 500 },
    );
  } finally {
    console.error = original;
  }
}
