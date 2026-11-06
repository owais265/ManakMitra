import { createFileRoute } from "@tanstack/react-router";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { RAG_CHUNK_COUNT } from "@/lib/rag";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        let pack = RAG_CHUNK_COUNT > 0;
        if (!pack) {
          try {
            const path = join(process.cwd(), "src/data/rag-pack.json");
            pack = existsSync(path) && statSync(path).size > 0;
          } catch {
            pack = false;
          }
        }
        return Response.json({ ok: true, pack });
      },
    },
  },
});