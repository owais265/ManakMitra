import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env.server";

function loadWorkspaceSupabaseEnv(): void {
  if (env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")) return;
  try {
    const text = readFileSync("/workspace/.grok/supabase.env", "utf8");
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* preview without file is pack-only */
  }
}

loadWorkspaceSupabaseEnv();

let cached: SupabaseClient | null | undefined;

/** Service-role client. Null when keys are missing. Never import from the browser. */
export function getServiceSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isHybridRagOn(): boolean {
  // Explicit off stays the kill switch. Otherwise: keys present → extras on.
  if (env("HYBRID_RAG") === "0") return false;
  return getServiceSupabase() !== null;
}

export function geminiEmbedKey(): string | undefined {
  return env("GEMINI_API_KEY") || env("GOOGLE_API_KEY") || env("GOOGLE_GENERATIVE_AI_API_KEY");
}

export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;
