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
  // Create the account tables on the first call if the build-time migrate could not.
  const { getSql } = await import("@/lib/db");
  await getSql();
  return auth.handler(request);
}
