/**
 * Hybrid Sparse + Dense RAG with Metadata Filter and Policy Gate.
 * Local TF-IDF pack remains the rank lock. pgvector 768-d extras only when
 * real embeddings exist for that kind AND extras are needed.
 * Never ranks leftover vector(256). Lock/strong pack never call embed.
 */
import { isLabCityQuery, labCityNeedles, vectorRetrieve } from "@/lib/rag";
import { isOfficialHost } from "@/lib/official-hosts";
import { isPolicyPinned, policyPinName } from "@/lib/policy-gate";
import { matchProductFamily } from "@/lib/product-playbook";
import type { EvidenceHit, Retrieval } from "@/lib/rag-types";
import { embedGemini768, getServiceSupabase, isHybridRagOn, geminiEmbedKey } from "@/lib/supabase.server";
import { rerankCandidates } from "@/lib/rerank.server";

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
  return { kind, title, body, url, score, lane: row.lane };
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
  return embedGemini768(text);
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

async function denseFromEmbedding(
  embedding: number[] | null,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: "lab" | "standard" | null,
): Promise<EvidenceHit[]> {
  if (!embedding) return [];
  const sb = getServiceSupabase();
  if (!sb) return [];
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
    const h = asHit({ ...row, lane: row.lane || "dense" }, Number(row.score || 0));
    if (h) hits.push(h);
  }
  return hits;
}

function sparseQuery(query: string, family: ReturnType<typeof matchProductFamily> | null): string {
  const is = query.match(/\bIS[\s/.:-]*(\d{3,5})\b/i);
  if (is) return `IS ${is[1]}`;
  const alias = family?.aliases.find((name) => /[A-Za-z]{4,}/.test(name));
  if (alias) return alias.slice(0, 80);
  const toks = distinctiveTokens(query).slice(0, 4);
  return (toks.join(" ") || query).slice(0, 80);
}

async function trgmExtras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: string | null,
): Promise<EvidenceHit[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("search_pack_docs_trgm", {
    q: sparseQuery(query, family),
    match_count: 6,
    filter_kind: kind,
    filter_family: family?.id ?? null,
  });
  if (error || !Array.isArray(data)) return [];
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit({ ...row, lane: row.lane || "trgm" }, Number(row.score || 0) * 0.3);
    if (h) hits.push(h);
  }
  return hits;
}

/** City must be a whole word in the lab name or address, not a contact-person first name. */
function labRowHasCity(row: RpcHit, needles: string[]): boolean {
  const title = row.title || "";
  const raw = typeof row.body === "string" ? row.body : String((row as { text?: string }).text || "");
  const cleaned = `${title}\n${raw}`.replace(/contact_person:\s*[^|\n]*/gi, " ");
  return needles.some((city) => {
    const esc = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z])${esc}(?:[^a-z]|$)`, "i").test(cleaned);
  });
}

async function labCityExtras(query: string): Promise<EvidenceHit[]> {
  const needles = labCityNeedles(query);
  if (!needles.length) return [];
  const sb = getServiceSupabase();
  if (!sb) return [];
  const parts = await Promise.all(
    needles.slice(0, 3).map(async (city) => {
      const { data, error } = await sb
        .from("pack_docs")
        .select("kind,is_number,title,url,host,scheme,family,text")
        .eq("kind", "lab")
        .ilike("text", `%${city}%`)
        .limit(8);
      if (error || !Array.isArray(data)) return [] as RpcHit[];
      return (data as RpcHit[]).filter((row) => labRowHasCity(row, needles));
    }),
  );
  const hits: EvidenceHit[] = [];
  const seen = new Set<string>();
  for (const row of parts.flat()) {
    const h = asHit(
      { ...row, body: typeof row.body === "string" ? row.body : String((row as { text?: string }).text || "") },
      0.4,
    );
    if (!h || seen.has(h.title) || !extraAllowed(query, h)) continue;
    seen.add(h.title);
    hits.push(h);
    if (hits.length >= 6) break;
  }
  return hits;
}

let bm25Missing = false;

async function bm25Extras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: string | null,
): Promise<EvidenceHit[]> {
  if (bm25Missing) return [];
  const sb = getServiceSupabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("search_pack_docs_bm25", {
    q: sparseQuery(query, family),
    match_count: 8,
    filter_kind: kind,
    filter_family: family?.id ?? null,
  });
  if (error || !Array.isArray(data)) {
    if (error && /search_pack_docs_bm25|schema cache|does not exist|PGRST202/i.test(error.message || "")) {
      bm25Missing = true;
    } else if (error) {
      console.warn("[hybrid bm25]", error.message);
    }
    return [];
  }
  const hits: EvidenceHit[] = [];
  for (const row of data as RpcHit[]) {
    const h = asHit({ ...row, lane: "bm25" }, Number(row.score || 0));
    if (h) hits.push(h);
  }
  return hits;
}

type HybridRpc = EvidenceHit[] | { missing: true; embedding: number[] | null };

async function hybridRpcExtras(
  query: string,
  family: ReturnType<typeof matchProductFamily> | null,
  kind: "lab" | "standard" | null,
): Promise<HybridRpc> {
  const sb = getServiceSupabase();
  if (!sb) return [];
  let embedding: number[] | null = null;
  if (await canDense(kind)) embedding = await embedQuery(query);
  const { data, error } = await sb.rpc("search_pack_docs_hybrid", {
    q: sparseQuery(query, family),
    query_embedding: embedding,
    match_count: 8,
    filter_kind: kind,
    filter_family: family?.id ?? null,
    filter_scheme: family?.scheme ?? null,
    extra_cap: 20,
  });
  if (error) {
    const msg = error.message || "";
    if (/search_pack_docs_hybrid|schema cache|does not exist|PGRST202/i.test(msg)) return { missing: true, embedding };
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

/** Rank-only fusion for the RPC-missing fallback. A missing lane adds 0. */
function rrfLanes(lanes: EvidenceHit[][]): EvidenceHit[] {
  const k = 60;
  const map = new Map<string, { hit: EvidenceHit; s: number }>();
  for (const lane of lanes) {
    lane.forEach((hit, index) => {
      const add = 1 / (k + index + 1);
      const prev = map.get(hit.title);
      if (prev) {
        prev.s += add;
        if (prev.hit.lane && hit.lane && prev.hit.lane !== hit.lane) prev.hit = { ...prev.hit, lane: "both" };
      } else {
        map.set(hit.title, { hit, s: add });
      }
    });
  }
  return [...map.values()].sort((a, b) => b.s - a.s).map((row) => row.hit);
}

/** A typed IS number already sitting on top is a lock. Extras must not replace it. */
function typedIsOnTop(query: string, base: Retrieval): boolean {
  if (!base.hasEvidence) return false;
  const title = base.hits[0]?.title || "";
  const ids = [...query.matchAll(/\bIS[\s/.:-]*(\d{3,5})\b/gi)].map((match) => match[1]);
  return ids.some((id) => new RegExp(`(?:^|\\D)${id}(?:\\D|$)`).test(title));
}

/** Extras only when the pack lock is weak. Strong lock and policy pins skip embed, BM25, trigram, and rerank. */
export function hybridExtrasAllowed(query: string, base: Retrieval): boolean {
  if (!isHybridRagOn()) return false;
  if (isPolicyPinned(base)) return false;
  if (typedIsOnTop(query, base)) return false;
  return extrasNeeded(query, base);
}

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

/** 5 Oct extract extras. Policy pins stay unless a precise corpus title matches. */
async function mergeCorpus(query: string, base: Retrieval): Promise<Retrieval> {
  let extras: EvidenceHit[] = [];
  try {
    const { searchBisCorpus } = await import("@/lib/corpus-search.server");
    extras = await searchBisCorpus(query);
  } catch {
    return base;
  }
  extras = extras.filter((h) => isOfficialHost(h.url)).slice(0, 2);
  if (!extras.length) return base;
  const pin = policyPinName(base);
  const softPin = pin === "no-table" || pin === "unknown-is" || pin === "what-bis";
  if (isPolicyPinned(base) && !softPin) return base;
  const top = base.hits[0]?.score ?? 0;
  if (top >= 0.9 && !softPin) {
    const locked = base.hits.filter((h) => h.score >= 0.45);
    const rest = extras.filter((h) => !locked.some((x) => x.title === h.title));
    if (!rest.length) return base;
    return { ...base, hits: [...locked, ...rest].slice(0, 8) };
  }
  const hits = mergeLocked(softPin ? [] : base.hits, extras).filter((h) => isOfficialHost(h.url));
  if (!hits.length) return base;
  return {
    ...base,
    hits,
    hasEvidence: true,
    grounding: softPin ? "verified" : base.grounding,
    confidence: base.confidence === "low" ? "medium" : base.confidence,
  };
}

export async function runHybridRetrieve(query: string): Promise<Retrieval> {
  const base = vectorRetrieve(query);
  const withCorpus = await mergeCorpus(query, base);
  if (!isHybridRagOn()) return withCorpus;
  if (!hybridExtrasAllowed(query, withCorpus)) return withCorpus;
  try {
    const family = matchProductFamily(query);
    const labCity = isLabCityQuery(query);
    const kind: "lab" | "standard" | null = labCity ? "lab" : family ? null : "standard";
    const rpc: HybridRpc = labCity ? { missing: true, embedding: null } : await hybridRpcExtras(query, family, kind);
    let extras: EvidenceHit[] = [];
    if (Array.isArray(rpc)) extras = rpc;
    else {
      const [trgm, labs, dense, bm25] = await Promise.all([
        labCity ? Promise.resolve([] as EvidenceHit[]) : trgmExtras(query, family, kind),
        labCity ? labCityExtras(query) : Promise.resolve([] as EvidenceHit[]),
        denseFromEmbedding(rpc.embedding, family, kind),
        labCity ? Promise.resolve([] as EvidenceHit[]) : bm25Extras(query, family, kind),
      ]);
      extras = rrfLanes([dense, bm25, trgm, labs]);
      if (!extras.length && family && !labCity) extras = await trgmExtras(query, null, null);
    }
    if (!extras.length) return withCorpus;
    extras = extras.filter((h) => extraAllowed(query, h));
    if (!extras.length) return withCorpus;
    const top = withCorpus.hits[0]?.score ?? 0;
    if (top < 0.45) extras = await rerankCandidates(query, extras, family?.id ?? null);
    extras = extras.filter((h) => isOfficialHost(h.url)).slice(0, 3);
    if (!extras.length) return withCorpus;
    const hits = mergeLocked(withCorpus.hits, extras).filter((h) => isOfficialHost(h.url));
    const hasEvidence = hits.length > 0;
    return {
      ...withCorpus,
      hits: hasEvidence ? hits : [],
      hasEvidence,
      grounding: hasEvidence ? withCorpus.grounding : "refuse",
    };
  } catch (err) {
    console.warn("[hybrid]", err instanceof Error ? err.message : err);
    return withCorpus;
  }
}
