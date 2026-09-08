import bundledPack from "@/data/rag-pack.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceHit, Retrieval } from "@/lib/rag-types";

type Chunk = { id: string; kind: EvidenceHit["kind"]; title: string; body: string; url: string };
type Pack = {
  verified: string;
  vocab: string[];
  idf: number[];
  docs: { i: number[]; v: number[] }[];
  chunks: Chunk[];
  catalogue?: Chunk[];
};

function loadPack(): Pack {
  try {
    if (import.meta.env.DEV) {
      const p = join(process.cwd(), "src/data/rag-pack.json");
      return JSON.parse(readFileSync(p, "utf8")) as Pack;
    }
  } catch {
    // published / serverless has no src/data on disk — use the bundled copy
  }
  try {
    return bundledPack as Pack;
  } catch {
    return { verified: "2026-09-08", vocab: [], idf: [], docs: [], chunks: [], catalogue: [] };
  }
}

const rag = loadPack();
const vocabIndex = new Map(rag.vocab.map((t, i) => [t, i]));
const catalogue = rag.catalogue || [];

const TOKEN_RE = /[a-z0-9]+|[\u0900-\u097f]+/gi;
const STOP = new Set(
  "a an the of for to in on and or is are with from by as at be this that your my i we you kya hai ke ki ka ko se mein aur ek please tell me about what how can do get apply bis indian standard standards".split(
    " ",
  ),
);

const HI_GLOSS: Record<string, string> = {
  आवेदन: "application",
  फीस: "fee",
  शुल्क: "fee",
  लाइसेंस: "licence",
  लाइसेन्स: "licence",
  प्रयोगशाला: "laboratory",
  लैब: "lab",
  हॉलमार्क: "hallmark",
  हालमार्क: "hallmark",
  प्रमाणन: "certification",
  आईएसआई: "isi",
  आईएस: "IS",
  मानक: "standard",
  सोना: "gold",
  गहना: "jewellery",
  आभूषण: "jewellery",
  शिकायत: "complaint",
  मार्क: "mark",
  योजना: "scheme",
  पंजीकरण: "registration",
};

const SYNONYMS: Record<string, string[]> = {
  bottle: ["pet", "container", "packaging", "packaged", "terephthalate", "polyalkylene"],
  plastic: ["plastics", "pet", "pbt", "packaging"],
  pet: ["terephthalate", "polyalkylene", "pbt"],
  gold: ["hallmark", "huid", "jewellery", "jewelry", "carat", "fineness"],
  hallmark: ["huid", "gold", "jewellery", "fineness"],
  huid: ["hallmark", "gold", "verify"],
  lab: ["laboratory", "testing", "recognised"],
  laboratory: ["lab", "testing", "recognised"],
  laptop: ["notebook", "tablet", "electronics", "crs"],
  charger: ["adapter", "electronics", "crs"],
  solar: ["photovoltaic", "crs", "mnre"],
  isi: ["licence", "license", "certification", "scheme"],
  crs: ["compulsory", "registration", "electronics", "scheme"],
  fee: ["application", "inspection", "marking", "licence"],
  complaint: ["grievance", "consumer", "cmed"],
  iso: ["is/iso", "iec", "adoption", "identical", "9001", "14001"],
  iec: ["is/iec", "iso", "adoption"],
  scheme: ["isi", "crs", "fmcs", "registration", "licence"],
  registration: ["crs", "compulsory", "scheme"],
  explore: ["bureau", "services", "act", "know"],
  bureau: ["national", "standards", "body"],
};

function tokens(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

function ngrams(toks: string[]): string[] {
  const out = [...toks];
  for (let i = 0; i < toks.length - 1; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
  return out;
}

function expandQuery(q: string): string {
  let glossed = q;
  for (const [hi, en] of Object.entries(HI_GLOSS)) {
    if (glossed.includes(hi)) glossed += ` ${en}`;
  }
  const raw = tokens(glossed);
  const extra: string[] = [];
  for (const t of raw) extra.push(...(SYNONYMS[t] || []));
  if (raw.includes("pet") || (raw.includes("plastic") && raw.includes("bottle"))) {
    extra.push("polyalkylene", "terephthalates", "foodstuffs", "pharmaceuticals");
  }
  return `${glossed} ${extra.join(" ")}`;
}

function embedSparse(text: string): Map<number, number> {
  const counts = new Map<string, number>();
  for (const g of ngrams(tokens(text))) counts.set(g, (counts.get(g) || 0) + 1);
  const vec = new Map<number, number>();
  let nrm = 0;
  for (const [term, tf] of counts) {
    const i = vocabIndex.get(term);
    if (i === undefined) continue;
    const w = (1 + Math.log(tf)) * rag.idf[i];
    vec.set(i, w);
    nrm += w * w;
  }
  nrm = Math.sqrt(nrm) || 1;
  for (const [i, w] of vec) vec.set(i, w / nrm);
  return vec;
}

function cosine(qv: Map<number, number>, doc: { i: number[]; v: number[] }): number {
  let s = 0;
  for (let n = 0; n < doc.i.length; n++) {
    const w = qv.get(doc.i[n]);
    if (w) s += w * doc.v[n];
  }
  return s;
}

function isNumbers(query: string): string[] {
  const out: string[] = [];
  const re = /\bIS[\s/.-]*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query))) out.push(m[1]);
  return out;
}

function coverage(queryToks: string[], hay: string): number {
  if (!queryToks.length) return 0;
  const h = hay.toLowerCase();
  return queryToks.filter((t) => h.includes(t)).length / queryToks.length;
}

function buildPostings(rows: Chunk[]): { tok: Map<string, number[]>; isn: Map<string, number[]> } {
  const tok = new Map<string, number[]>();
  const isn = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const blob = `${rows[i].title} ${rows[i].body}`;
    const seen = new Set<string>();
    for (const t of tokens(blob)) {
      if (seen.has(t)) continue;
      seen.add(t);
      const arr = tok.get(t);
      if (arr) arr.push(i);
      else tok.set(t, [i]);
    }
    for (const id of isNumbers(blob)) {
      const arr = isn.get(id);
      if (arr) arr.push(i);
      else isn.set(id, [i]);
    }
  }
  return { tok, isn };
}

const richPost = buildPostings(rag.chunks);
const catPost = buildPostings(catalogue);

function candidateIds(
  post: { tok: Map<string, number[]>; isn: Map<string, number[]> },
  queryToks: string[],
  ids: string[],
  cap: number,
): number[] {
  const scores = new Map<number, number>();
  for (const id of ids) {
    for (const i of post.isn.get(id) || []) scores.set(i, (scores.get(i) || 0) + 10);
  }
  for (const t of queryToks) {
    const extra = SYNONYMS[t] || [];
    for (const term of [t, ...extra]) {
      const list = post.tok.get(term);
      if (!list) continue;
      const w = extra.includes(term) ? 0.55 : 1;
      for (const i of list) scores.set(i, (scores.get(i) || 0) + w);
    }
  }
  if (!scores.size) return [];
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([i]) => i);
}

function toHit(ch: Chunk, score: number): EvidenceHit {
  return {
    kind: ch.kind,
    title: ch.title,
    body: ch.body,
    url: ch.url,
    score: Math.round(score * 1000) / 1000,
  };
}

export function vectorRetrieve(query: string): Retrieval {
  const q = query.trim();
  const queryToks = tokens(q);
  const ids = isNumbers(q);
  const expanded = expandQuery(q);
  const expToks = tokens(expanded);
  const qv = embedSparse(expanded);

  const richHits: EvidenceHit[] = [];
  const richCand = candidateIds(richPost, expToks, ids, 220);
  const richScored = richCand.map((i) => {
    let s = cosine(qv, rag.docs[i]);
    const ch = rag.chunks[i];
    const blob = `${ch.title} ${ch.body}`.toLowerCase();
    for (const id of ids) {
      if (blob.includes(id)) s += 0.4;
    }
    if (/scheme|what is|legal|steps|process|versus|explore|adopt/.test(q.toLowerCase())) {
      if (ch.kind === "process" || ch.kind === "faq" || ch.kind === "link" || ch.kind === "consumer") s += 0.22;
      if (ch.kind === "crs") s -= 0.08;
    }
    return { i, s };
  });
  richScored.sort((a, b) => b.s - a.s);
  for (const row of richScored.slice(0, 8)) {
    if (row.s < 0.08 && !ids.length) continue;
    richHits.push(toHit(rag.chunks[row.i], row.s));
    if (richHits.length >= 5) break;
  }

  const catHits: EvidenceHit[] = [];
  const catCand = candidateIds(catPost, expToks, ids, 250);
  const catScored = catCand.map((i) => {
    const ch = catalogue[i];
    const blob = `${ch.title} ${ch.body}`.toLowerCase();
    let s = 0;
    for (const id of ids) {
      if (ch.title.toLowerCase().includes(id) || blob.includes(id)) s += 0.7;
    }
    const cov = coverage(queryToks.length ? queryToks : expToks, blob);
    s += cov * 0.45;
    if (queryToks.some((t) => ch.title.toLowerCase().includes(t))) s += 0.08;
    return { i, s, cov };
  });
  catScored.sort((a, b) => b.s - a.s);
  for (const row of catScored.slice(0, 8)) {
    if (row.s < 0.12 && !ids.length) continue;
    catHits.push(toHit(catalogue[row.i], row.s));
    if (catHits.length >= 5) break;
  }

  const schemeQuery = /crs|scheme|isi|fmcs|hallmark|huid|fee|licence|license|iso|iec|lab|complaint|explore|bureau|act 2016|registration/.test(
    q.toLowerCase(),
  );
  const merged: EvidenceHit[] = [];
  const seen = new Set<string>();
  const prefer = schemeQuery && !ids.length ? [...richHits, ...catHits] : [...catHits, ...richHits];
  if (schemeQuery && richHits.length) {
    for (const h of richHits) {
      const k = h.title;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(h);
      if (merged.length >= 6) break;
    }
  }
  for (const h of prefer) {
    const k = h.title;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(h);
    if (merged.length >= 6) break;
  }

  const best = merged[0];
  const bestCov = best ? coverage(queryToks, `${best.title} ${best.body}`) : 0;
  const bestScore = best?.score ?? 0;
  const schemeKind =
    best && ["faq", "process", "hallmark", "product", "crs", "lab", "consumer", "link"].includes(best.kind);
  const hasEvidence = Boolean(
    merged.length &&
      (ids.length
        ? bestScore >= 0.12
        : schemeKind
          ? bestScore >= 0.1
          : bestScore >= 0.14 || bestCov >= 0.3),
  );

  const ql = q.toLowerCase();
  let mode: Retrieval["mode"] = "general";
  if (/hallmark|huid|gold|jewel/.test(ql) || merged.some((h) => h.kind === "hallmark")) mode = "hallmarking";
  else if (merged.some((h) => h.kind === "standard" || h.kind === "crs" || h.kind === "product")) mode = "standards";

  const confidence: Retrieval["confidence"] = !hasEvidence
    ? "low"
    : bestScore >= 0.35
      ? "high"
      : bestScore >= 0.18
        ? "medium"
        : "low";

  return { query: q, hits: hasEvidence ? merged : [], mode, confidence, hasEvidence };
}

export const RAG_VERIFIED = rag.verified;
export const RAG_CHUNK_COUNT = rag.chunks.length + catalogue.length;
