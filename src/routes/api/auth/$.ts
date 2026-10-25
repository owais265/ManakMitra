import "@/lib/postgres-url";
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
  try {
    const { getSql } = await import("@/lib/db");
    await getSql();
    return await auth.handler(request);
  } catch (error) {
    const err = error as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } };
    console.error("[auth] failed", err.code || err.cause?.code || err.name || "error");
    return Response.json(
      { status: 500, code: err.code || err.cause?.code || err.name || "error" },
      { status: 500 },
    );
  }
}
