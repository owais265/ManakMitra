/**
 * Hybrid Sparse + Dense RAG with Metadata Filter and Policy Gate.
 * Local TF-IDF pack remains the rank lock. pgvector 768-d extras only when
 * real embeddings exist for that kind AND extras are needed.
 * Never ranks leftover vector(256). Lock/strong pack never call embed.
 */
import { isLabCityQuery, vectorRetrieve } from "@/lib/rag";
import { isOfficialHost } from "@/lib/official-hosts";
import { isPolicyPinned } from "@/lib/policy-gate";
import { matchProductFamily } from "@/lib/product-playbook";
import type { EvidenceHit, Retrieval } from "@/lib/rag-types";
import { EMBED_MODEL, getServiceSupabase, isHybridRagOn, geminiEmbedKey } from "@/lib/supabase.server";

type RpcHit = {
  kind?: string;
  is_number?: string | null;
  title?: string;
  url?: string;
  host?: string;
  scheme?: string | null;
  family?: string | null;
  body?: string;
  score?: number;
  lane?: string;
};

const KINDS = new Set<EvidenceHit["kind"]>([
  "standard",
  "product",
  "process",
  "lab",
  "hallmark",
  "crs",
  "faq",
  "consumer",
  "link",
]);

function asHit(row: RpcHit, score: number): EvidenceHit | null {
  const url = typeof row.url === "string" ? row.url : "";
  if (!url || !isOfficialHost(url)) return null;
  const title = (row.title || "").trim();
  if (!title) return null;
  const kind = KINDS.has(row.kind as EvidenceHit["kind"]) ? (row.kind as EvidenceHit["kind"]) : "link";
  const isNo = row.is_number ? `IS ${row.is_number}` : "";
  const body = [isNo, row.body || "", row.family ? `family:${row.family}` : "", row.scheme ? `scheme:${row.scheme}` : ""]
    .filter(Boolean)
    .join(" ")
    .slice(0, 700);
  return { kind, title, body, url, score };
}

function mergeLocked(lock: EvidenceHit[], extras: EvidenceHit[]): EvidenceHit[] {
  const frozen = lock.filter((h) => h.score >= 0.45);
  const frozenTitles = new Set(frozen.map((h) => h.title));
  const restLock = lock.filter((h) => !frozenTitles.has(h.title));
  const extrasClean = extras
    .filter((h) => isOfficialHost(h.url) && !frozenTitles.has(h.title))
    .slice(0, 3);
  const k = 60;
  const rrf = new Map<string, { hit: EvidenceHit; s: number }>();
  restLock.forEach((h, i) => rrf.set(h.title, { hit: h, s: 1 / (k + i + 1) + h.score * 0.02 }));
  extrasClean.forEach((h, i) => {
    const prev = rrf.get(h.title);
    const add = 1 / (k + i + 1);
    if (prev) prev.s += add;
    else rrf.set(h.title, { hit: { ...h, score: Math.min(h.score, 0.39) }, s: add });
  });
  const mergedRest = [...rrf.values()].sort((a, b) => b.s - a.s).map((x) => x.hit);
  const out: EvidenceHit[] = [...frozen];
  for (const h of mergedRest) {
    if (out.some((x) => x.title === h.title)) continue;
    out.push(h);
    if (out.length >= 14) break;
  }
  return out.length ? out : lock;
}

async function embedQuery(text: string): Promise<number[] | null> {
  const key = geminiEmbedKey();
  if (!key) return null;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent` +
    `?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: text.slice(0, 4000) }] },
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!Array.isArray(values) || values.length !== 768) return null;
  return values;
}

const GENERIC_TOKEN =
  /^(lab|labs|laboratory|laboratories|bis|isi|crs|recognised|recognized|testing|test|list|live|lims|institute|centre|center|pvt|ltd|india|indian|standard|standards|mark|certification|registration|group|pdf|directory|search|own|empanelled|near|me)$/i;

function distinctiveTokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f]+/)
    .filter((t) => t.length >= 4 && !GENERIC_TOKEN.test(t));
}

/** City/product extras only. Generic "lab" must not dump unrelated labs (Adityapur on a Raipur ask). */
function extraAllowed(query: string, hit: EvidenceHit): boolean {
  if (hit.kind !== "lab") return true;
  const toks = distinctiveTokens(query);
  if (!toks.length) return false;
  const blob = `${hit.title} ${hit.body}`.toLowerCase();
  return toks.some((t) => blob.includes(t));
}

let embedCountCache: { total: number; byKind: Record<string, number> } | null = null;

async function embedCounts(): Promise<{ total: number; byKind: Record<string, number> }> {
  if (embedCountCache) return embedCountCache;
  const sb = getServiceSupabase();
  if (!sb || !geminiEmbedKey()) {
    embedCountCache = { total: 0, byKind: {} };
    return embedCountCache;
  }
  const kinds = ["standard", "lab", "crs", "faq", "process", "hallmark"] as const;
  const rows = await Promise.all(
    kinds.map(async (kind) => {
      const { count } = await sb
        .from("pack_docs")
        .select("*", { count: "exact", head: true })
        .eq("kind", kind)
        .not("embedding", "is", null);
      return [kind, count ?? 0] as const;
    }),
  );
  const byKind: Record<string, number> = {};
  let total = 0;
  for (const [k, n] of rows) {
    byKind[k] = n;
    total += n;
  }
  embedCountCache = { total, byKind };
  return embedCountCache;
}

/** Dense only when that lane is filled. 1-row standard index must not nearest-neighbour pollute. */
async function canDense(kind: "lab" | "standard" | null): Promise<boolean> {
  const c = await embedCounts();
  if (kind === "lab") return (c.byKind.lab || 0) >= 50;
  if (kind === "standard") return (c.byKind.standard || 0) >= 400;
  return c.total >= 400;
}

async function denseExtras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: "lab" | "standard" | null,
): Promise<EvidenceHit[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  if (!(await canDense(kind))) return [];
  const embedding = await embedQuery(query);
  if (!embedding) return [];
  const { data, error } = await sb.rpc("match_pack_docs", {
    query_embedding: embedding,
    match_count: 8,
    filter_kind: kind,
    filter_family: family?.id ?? null,
    filter_scheme: family?.scheme ?? null,
  });
  if (error || !Array.isArray(data)) {
    if (error) console.warn("[hybrid dense]", error.message);
    return [];
  }
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit(row, Number(row.score || 0));
    if (h) hits.push(h);
  }
  return hits;
}

async function trgmExtras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: string | null,
): Promise<EvidenceHit[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("search_pack_docs_trgm", {
    q: query.slice(0, 200),
    match_count: 6,
    filter_kind: kind,
    filter_family: family?.id ?? null,
  });
  if (error || !Array.isArray(data)) return [];
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit(row, Number(row.score || 0) * 0.3);
    if (h) hits.push(h);
  }
  return hits;
}

async function labCityExtras(query: string): Promise<EvidenceHit[]> {
  const toks = distinctiveTokens(query);
  if (!toks.length) return [];
  const sb = getServiceSupabase();
  if (!sb) return [];
  const city = [...toks].sort((a, b) => b.length - a.length)[0];
  if (!city || city.length > 40) return [];
  const { data, error } = await sb
    .from("pack_docs")
    .select("kind,is_number,title,url,host,scheme,family,text")
    .eq("kind", "lab")
    .ilike("text", `%${city}%`)
    .limit(6);
  if (error || !Array.isArray(data)) return [];
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit({ ...row, body: typeof row.body === "string" ? row.body : String((row as { text?: string }).text || "") }, 0.4);
    if (h && extraAllowed(query, h)) hits.push(h);
  }
  return hits;
}

async function hybridRpcExtras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: "lab" | "standard" | null,
): Promise<EvidenceHit[] | "missing"> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  let embedding: number[] | null = null;
  if (await canDense(kind)) embedding = await embedQuery(query);
  const { data, error } = await sb.rpc("search_pack_docs_hybrid", {
    q: query.slice(0, 200),
    query_embedding: embedding,
    match_count: 8,
    filter_kind: kind,
    filter_family: family?.id ?? null,
    filter_scheme: family?.scheme ?? null,
    extra_cap: 3,
  });
  if (error) {
    const msg = error.message || "";
    if (/search_pack_docs_hybrid|schema cache|does not exist|PGRST202/i.test(msg)) return "missing";
    console.warn("[hybrid rpc]", msg);
    return [];
  }
  if (!Array.isArray(data)) return [];
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit(row, Number(row.score || 0));
    if (h) hits.push(h);
  }
  return hits;
}

/** Extras (trgm/dense) only when pack lock is weak or city labs are missing. Never on policy pin. */
function extrasNeeded(query: string, base: Retrieval): boolean {
  if (isPolicyPinned(base)) return false;
  if (isLabCityQuery(query)) {
    const cityLabs = base.hits.filter((h) => h.kind === "lab" && h.score >= 0.5 && extraAllowed(query, h));
    return cityLabs.length === 0;
  }
  if (!base.hasEvidence || base.confidence === "low") return true;
  const top = base.hits[0]?.score ?? 0;
  if (top >= 0.45) return false;
  return top < 0.35;
}

export async function runHybridRetrieve(query: string): Promise<Retrieval> {
  const base = vectorRetrieve(query);
  if (!isHybridRagOn()) return base;
  if (isPolicyPinned(base)) return base;
  if (!extrasNeeded(query, base)) return base;
  try {
    const family = matchProductFamily(query);
    const labCity = isLabCityQuery(query);
    const kind: "lab" | "standard" | null = labCity ? "lab" : family ? null : "standard";
    const rpc = labCity ? "missing" : await hybridRpcExtras(query, family, kind);
    let extras: EvidenceHit[] = [];
    if (rpc !== "missing") extras = rpc;
    else {
      const wantDense = !labCity && (await canDense(kind));
      const [trgm, labs, dense] = await Promise.all([
        labCity ? Promise.resolve([] as EvidenceHit[]) : trgmExtras(query, family, kind),
        labCity ? labCityExtras(query) : Promise.resolve([] as EvidenceHit[]),
        wantDense ? denseExtras(query, family, kind) : Promise.resolve([] as EvidenceHit[]),
      ]);
      extras = [...dense, ...trgm, ...labs];
      if (!extras.length && family) extras = await trgmExtras(query, null, null);
    }
    if (!extras.length) return base;
    extras = extras.filter((h) => extraAllowed(query, h)).slice(0, 3);
    if (!extras.length) return base;
    const hits = mergeLocked(base.hits, extras).filter((h) => isOfficialHost(h.url));
    const hasEvidence = hits.length > 0;
    return {
      ...base,
      hits: hasEvidence ? hits : [],
      hasEvidence,
      grounding: hasEvidence ? base.grounding : "refuse",
    };
  } catch (err) {
    console.warn("[hybrid]", err instanceof Error ? err.message : err);
    return base;
  }
}
