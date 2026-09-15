#!/usr/bin/env node
/**
 * Ingest authorised rag-pack + verified-boost into pack_docs (768-d schema).
 * Does NOT read bis_knowledge_base_large.json or synthetic Q&A.
 * Unchanged source_hash → skip. Embed with Gemini gemini-embedding-001 (768-d).
 * Missing embed key → insert text+metadata, embedding null, keep HYBRID_RAG=0.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const text = readFileSync(join(root, ".grok/supabase.env"), "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* pack-only dry run */
}
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const { matchProductFamily } = jiti(join(root, "src/lib/product-playbook.ts")) as {
  matchProductFamily: (q: string) => { id: string; scheme: string | null; is: string[] } | null;
};
const { officialHostOrNull } = jiti(join(root, "src/lib/official-hosts.ts")) as {
  officialHostOrNull: (url: string) => string | null;
};

type Kind = "standard" | "crs" | "lab" | "faq" | "process" | "hallmark" | "consumer" | "link" | "product";
type Chunk = { id?: string; kind?: string; title?: string; body?: string; url?: string };
type PackDoc = {
  source_hash: string;
  kind: Kind;
  is_number: string | null;
  title: string;
  url: string;
  host: string;
  scheme: string | null;
  family: string | null;
  group_name: string | null;
  extra: Record<string, unknown>;
  text: string;
};

const KINDS = new Set<Kind>(["standard", "crs", "lab", "faq", "process", "hallmark", "consumer", "link", "product"]);
const EMBED_MODEL = "gemini-embedding-001";
const BATCH = 20;
const EMBED_BATCH = 8;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function parseIs(title: string, body: string): string | null {
  const blob = `${title} ${body}`;
  const m = blob.match(/\bIS(?:\/ISO|\/IEC)?[\s._-]*([0-9]{2,5})(?:-[0-9]+)?/i);
  return m ? m[1] : null;
}

function asKind(k: string | undefined): Kind {
  if (k && KINDS.has(k as Kind)) return k as Kind;
  return "link";
}

function mapChunk(c: Chunk, source: string): PackDoc | { reject: string } {
  const title = (c.title || "").trim();
  const url = (c.url || "").trim();
  const body = (c.body || "").trim();
  if (!title || !url) return { reject: "missing-title-or-url" };
  const host = officialHostOrNull(url);
  if (!host) return { reject: url };
  const kind = asKind(c.kind);
  const is_number = parseIs(title, body);
  const text = `${title}\n${body}`.slice(0, 8000);
  const familyHit = matchProductFamily(`${title} ${body}`);
  const scheme =
    kind === "crs" ? "crs" : kind === "hallmark" ? "hallmark" : familyHit?.scheme || null;
  const source_hash = sha256(`${kind}|${is_number || ""}|${url}|${text}`);
  return {
    source_hash,
    kind,
    is_number,
    title: title.slice(0, 500),
    url,
    host,
    scheme,
    family: familyHit?.id || null,
    group_name: null,
    extra: { pack_id: c.id || null, source },
    text,
  };
}

function loadInboxChunks(): Chunk[] {
  const dir = join(root, "data/inbox");
  if (!existsSync(dir)) return [];
  const out: Chunk[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "README.md") continue;
    const path = join(dir, name);
    if (name.endsWith(".json")) {
      try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object" && Array.isArray((raw as { chunks?: unknown }).chunks)
            ? (raw as { chunks: unknown[] }).chunks
            : raw && typeof raw === "object" && Array.isArray((raw as { catalogue?: unknown }).catalogue)
              ? (raw as { catalogue: unknown[] }).catalogue
              : [raw];
        for (const item of list) {
          if (item && typeof item === "object") out.push(item as Chunk);
        }
      } catch (err) {
        console.warn("inbox skip", name, err instanceof Error ? err.message : err);
      }
      continue;
    }
    if (name.endsWith(".csv")) {
      const text = readFileSync(path, "utf8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) continue;
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      const idx = (k: string) => header.indexOf(k);
      for (const line of lines.slice(1)) {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const title = cols[idx("title")] || "";
        const url = cols[idx("url")] || "";
        if (!title || !url) continue;
        out.push({
          id: cols[idx("id")] || `inbox-${name}-${title.slice(0, 24)}`,
          kind: cols[idx("kind")] || "link",
          title,
          body: cols[idx("body")] || "",
          url,
        });
      }
    }
  }
  return out;
}

function writeInboxBoost(chunks: Chunk[]): void {
  const clean = chunks
    .filter((c) => (c.title || "").trim() && (c.url || "").trim())
    .map((c) => ({
      id: String(c.id || c.url || c.title).slice(0, 120),
      kind: asKind(c.kind),
      title: String(c.title).slice(0, 500),
      body: String(c.body || "").slice(0, 4000),
      url: String(c.url).trim(),
    }));
  writeFileSync(join(root, "src/data/inbox-boost.json"), `${JSON.stringify(clean, null, 2)}\n`);
}

function loadRows(): { rows: PackDoc[]; rejectedHosts: number; skippedBad: number; inboxChunks: number } {
  const pack = JSON.parse(readFileSync(join(root, "src/data/rag-pack.json"), "utf8")) as {
    chunks?: Chunk[];
    catalogue?: Chunk[];
  };
  const boost = JSON.parse(readFileSync(join(root, "src/data/verified-boost.json"), "utf8")) as Chunk[];
  const inbox = loadInboxChunks();
  writeInboxBoost(inbox);
  const raw: { c: Chunk; source: string }[] = [
    ...(pack.chunks || []).map((c) => ({ c, source: "rag-pack.chunks" })),
    ...(boost || []).map((c) => ({ c, source: "verified-boost" })),
    ...(pack.catalogue || []).map((c) => ({ c, source: "rag-pack.catalogue" })),
    ...inbox.map((c) => ({ c, source: "inbox" })),
  ];
  const seen = new Set<string>();
  const rows: PackDoc[] = [];
  let rejectedHosts = 0;
  let skippedBad = 0;
  for (const { c, source } of raw) {
    const mapped = mapChunk(c, source);
    if ("reject" in mapped) {
      if (mapped.reject === "missing-title-or-url") skippedBad += 1;
      else rejectedHosts += 1;
      continue;
    }
    if (seen.has(mapped.source_hash)) continue;
    seen.add(mapped.source_hash);
    rows.push(mapped);
  }
  return { rows, rejectedHosts, skippedBad, inboxChunks: inbox.length };
}

async function embedBatch(texts: string[], key: string): Promise<(number[] | null)[]> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents` +
    `?key=${encodeURIComponent(key)}`;
  let last = "embed failed";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 2000) }] },
          outputDimensionality: 768,
        })),
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { embeddings?: { values?: number[] }[] };
      const out = json.embeddings || [];
      return texts.map((_, i) => {
        const values = out[i]?.values;
        return Array.isArray(values) && values.length === 768 ? values : null;
      });
    }
    last = `embed ${res.status}: ${(await res.text()).slice(0, 180)}`;
    if (res.status === 429) {
      await sleep(45000);
      continue;
    }
    if (res.status < 500) break;
    await sleep(800 * 2 ** attempt);
  }
  throw new Error(last);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function upsertSlice(
  sb: ReturnType<typeof createClient>,
  slice: PackDoc[],
  at: number,
): Promise<void> {
  let last = "unknown";
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await sb.from("pack_docs").upsert(slice, { onConflict: "source_hash", ignoreDuplicates: true });
    if (!error) return;
    last = error.message;
    const retryable = /timeout|fetch|network|503|502|429|gateway/i.test(error.message);
    if (!retryable || attempt === 5) break;
    await sleep(800 * 2 ** attempt);
  }
  throw new Error(`upsert failed at ${at}: ${last}`);
}

async function main() {
  const { rows, rejectedHosts, skippedBad, inboxChunks } = loadRows();
  const embedKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  console.log(
    JSON.stringify(
      {
        prepared: rows.length,
        inbox: inboxChunks,
        rejectedHosts,
        skippedBad,
        embedModel: embedKey ? EMBED_MODEL : "none",
        embedDims: embedKey ? 768 : 0,
        hybridDefault: process.env.HYBRID_RAG === "1" ? "1" : "0",
        supabase: Boolean(supabaseUrl && serviceKey),
      },
      null,
      2,
    ),
  );

  if (!supabaseUrl || !serviceKey) {
    console.log("No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — dry run only. Paste supabase/pack_docs.sql in the SQL editor, then re-run npm run pack:ingest.");
    return;
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existing = new Set<string>();
  const { error: countErr } = await sb.from("pack_docs").select("*", { count: "exact", head: true });
  if (countErr) {
    console.error("select pack_docs failed (apply supabase/pack_docs.sql first):", countErr.message);
    process.exit(1);
  }
  let from = 0;
  for (;;) {
    const { data, error } = await sb.from("pack_docs").select("source_hash").range(from, from + 999);
    if (error) {
      console.error("select pack_docs failed (apply supabase/pack_docs.sql first):", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    for (const r of data) existing.add(String((r as { source_hash: string }).source_hash));
    if (data.length < 1000) break;
    from += 1000;
  }

  const fresh = rows.filter((r) => !existing.has(r.source_hash));
  let inserted = 0;
  let skipped = rows.length - fresh.length;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH);
    await upsertSlice(sb, slice, i);
    inserted += slice.length;
    if (inserted === slice.length || inserted % 400 === 0 || i + BATCH >= fresh.length) {
      console.log("inserted", inserted, "/", fresh.length);
    }
    await sleep(40);
  }

  let embedded = 0;
  let embedFailed = 0;
  const maxEmbed = Number(process.env.INGEST_MAX_EMBED || "20000") || 20000;
  if (embedKey) {
    const kinds = ["faq", "process", "hallmark", "crs", "lab", "consumer", "product", "link", "standard"];
    kindLoop: for (const kind of kinds) {
      if (embedded >= maxEmbed) break;
      for (;;) {
        if (embedded >= maxEmbed) break kindLoop;
        const take = Math.min(800, maxEmbed - embedded);
        const { data: need, error: needErr } = await sb
          .from("pack_docs")
          .select("source_hash, text, kind")
          .eq("kind", kind)
          .is("embedding", null)
          .limit(take);
        if (needErr) {
          console.error("select pending embeddings failed:", needErr.message);
          break kindLoop;
        }
        const pending = (need || []) as { source_hash: string; text: string; kind?: string }[];
        if (!pending.length) break;
        console.log("embedding kind", kind, "batch", pending.length);
        let stop = false;
        for (let i = 0; i < pending.length && embedded < maxEmbed && !stop; i += EMBED_BATCH) {
          const slice = pending.slice(i, i + EMBED_BATCH);
          try {
            const vecs = await embedBatch(
              slice.map((r) => r.text),
              embedKey,
            );
            const rows = [];
            for (let j = 0; j < slice.length; j++) {
              const v = vecs[j];
              if (!v) {
                embedFailed += 1;
                continue;
              }
              rows.push({ source_hash: slice[j].source_hash, embedding: v });
            }
            const results = await Promise.all(
              rows.map((row) =>
                sb.from("pack_docs").update({ embedding: row.embedding }).eq("source_hash", row.source_hash),
              ),
            );
            for (const r of results) {
              if (r.error) embedFailed += 1;
              else embedded += 1;
            }
            if (embedded && (embedded % 40 === 0 || slice.length < EMBED_BATCH)) {
              console.log("embedded", embedded, "kind", kind);
            }
          } catch (err) {
            embedFailed += slice.length;
            const msg = err instanceof Error ? err.message : String(err);
            console.warn("embed batch failed", msg);
            if (/401|403|API_KEY|invalid|PERMISSION/i.test(msg) && !/429/.test(msg)) {
              stop = true;
              break kindLoop;
            }
            await sleep(1500);
          }
        }
        if (stop) break kindLoop;
      }
    }
  } else {
    console.log("No Gemini/Google embed key — embeddings left null. Metadata/trgm extras still run.");
  }

  const { count } = await sb.from("pack_docs").select("*", { count: "exact", head: true });
  const { count: withEmbed } = await sb
    .from("pack_docs")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  console.log(
    JSON.stringify(
      {
        inserted,
        skippedUnchanged: skipped,
        rejectedHosts,
        embedded,
        embedFailed,
        embedModel: embedKey ? EMBED_MODEL : "none",
        packDocsRows: count ?? null,
        packDocsWithEmbedding: withEmbed ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
