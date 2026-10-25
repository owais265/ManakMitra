import { clearPgCode, lastPgCode } from "@/lib/pg-guard";
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

async function handleAuth(request: Request): Promise<Response> {
  clearPgCode();
  try {
    const { getSql } = await import("@/lib/db");
    await getSql();
    const response = await auth.handler(request);
    if (response.status < 500) return response;
    const code = lastPgCode() || "unknown";
    return Response.json({ status: response.status, code }, { status: response.status });
  } catch (error) {
    const err = error as { name?: string; code?: string; cause?: { code?: string } };
    const code = err.code || err.cause?.code || lastPgCode() || err.name || "error";
    console.error("[auth] failed", code);
    return Response.json({ status: 500, code }, { status: 500 });
  }
}
