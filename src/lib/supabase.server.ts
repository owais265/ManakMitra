import { readFileSync, writeFileSync } from "node:fs";
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
  return geminiEmbedKeys()[0];
}

const coolUntil = new Map<number, number>();
let keyCursor = 0;
let keyPool: string[] | null = null;
let coolLoaded = false;
const QUERY_COOL = "/workspace/.grok/query-embed-cool.json";

function loadQueryCool() {
  try {
    const data = JSON.parse(readFileSync(QUERY_COOL, "utf8")) as {
      cursor?: number;
      cool?: Record<string, number>;
    };
    if (typeof data.cursor === "number" && data.cursor >= 0) keyCursor = data.cursor;
    for (const [k, v] of Object.entries(data.cool || {})) {
      const index = Number(k);
      if (Number.isInteger(index) && index >= 0 && typeof v === "number") coolUntil.set(index, v);
    }
  } catch {
    /* first run */
  }
}

function storeQueryCool() {
  const cool: Record<string, number> = {};
  for (const [index, until] of coolUntil) cool[String(index)] = until;
  try {
    writeFileSync(QUERY_COOL, JSON.stringify({ cursor: keyCursor, cool }));
  } catch {
    /* preview can run without the file */
  }
}

function ensureQueryCool() {
  if (coolLoaded) return;
  coolLoaded = true;
  loadQueryCool();
}

/** RPM stays short. Daily uses the API delay. 403 retires the key. */
function coolMs(status: number, body: string): number {
  if (status === 401 || status === 403) return 30 * 86400_000;
  let ms = 15_000;
  const wait = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (wait) ms = Math.max(Number(wait[1]) * 1000, 1000);
  if (/perday|per day|PerDay|requestsperday/i.test(body) || ms > 600_000) return Math.max(ms, 60_000);
  return Math.min(ms, 90_000);
}

async function embedOnce(key: string, text: string): Promise<{ values: number[] | null; status: number; body: string }> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent` +
    `?key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { values: null, status: res.status, body: await res.text().catch(() => "") };
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    const values = json.embedding?.values;
    if (!Array.isArray(values) || values.length !== 768) return { values: null, status: 200, body: "bad-dim" };
    return { values, status: 200, body: "" };
  } catch (err) {
    return { values: null, status: 0, body: err instanceof Error ? err.message : "fetch" };
  }
}

/**
 * Query vector for hybrid search. Sticks to one Gemini key.
 * On 429, 403, or a dead response, cools that key and tries the next in the same call.
 * Does not sleep through a long quota. A sub-1.5s RPM wait is retried once.
 */
export async function embedGemini768(text: string): Promise<number[] | null> {
  const keys = geminiEmbedKeys();
  if (!keys.length) return null;
  ensureQueryCool();
  if (keyCursor >= keys.length) keyCursor = 0;
  const slice = text.slice(0, 4000) || " ";
  for (let pass = 0; pass < 2; pass++) {
    let cursor = keyCursor % keys.length;
    for (let tried = 0; tried < keys.length; tried++) {
      const index = cursor;
      cursor = (cursor + 1) % keys.length;
      if ((coolUntil.get(index) || 0) > Date.now()) continue;
      const hit = await embedOnce(keys[index], slice);
      if (hit.values) {
        keyCursor = index;
        storeQueryCool();
        return hit.values;
      }
      const ms = hit.status === 429 || hit.status === 403 || hit.status === 401 ? coolMs(hit.status, hit.body) : 5_000;
      coolUntil.set(index, Date.now() + ms);
      keyCursor = cursor;
      storeQueryCool();
    }
    const soonest = Math.min(...keys.map((_, index) => coolUntil.get(index) || 0));
    const wait = soonest - Date.now();
    if (pass === 0 && wait > 0 && wait <= 1500) {
      await new Promise((resolve) => setTimeout(resolve, wait));
      continue;
    }
    return null;
  }
  return null;
}

export function geminiEmbedKeys(): string[] {
  if (keyPool) return keyPool;
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    const v = raw?.trim();
    if (!v || v.startsWith("#") || out.includes(v)) return;
    out.push(v);
  };
  push(env("GEMINI_API_KEY"));
  push(env("GOOGLE_API_KEY"));
  push(env("GOOGLE_GENERATIVE_AI_API_KEY"));
  for (const part of (env("GEMINI_API_KEYS") || "").split(/[\n,]/)) push(part);
  for (const path of ["/workspace/.grok/gemini-embed-keys.txt", ".grok/gemini-embed-keys.txt"]) {
    try {
      for (const line of readFileSync(path, "utf8").split("\n")) push(line);
    } catch {
      /* pool file is optional */
    }
  }
  keyPool = out;
  return out;
}

export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;
