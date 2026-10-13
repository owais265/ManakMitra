import { isOfficialHost } from "@/lib/official-hosts";
import type { EvidenceHit } from "@/lib/rag-types";

const STOP = new Set(
  "standard standards mark bis the and for with from that this product products indian what how are".split(" "),
);

function queryIds(query: string): Set<string> {
  const ids = new Set<string>();
  for (const match of query.matchAll(/\bIS[\s/.:-]*(\d{3,5})\b/gi)) ids.add(match[1]);
  for (const match of query.matchAll(/(?:^|[^\d])(\d{3,5})(?:[^\d]|$)/g)) ids.add(match[1]);
  return ids;
}

function distinctive(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097f]+/)
    .filter((token) => token.length >= 4 && !STOP.has(token));
}

/**
 * Tie-break only. Not a neural rerank. Official hosts only.
 * Features, in order: exact IS id, distinctive token in the title,
 * BM25/both lane, kind aligned to the product family.
 */
export function featureRerank(query: string, rows: EvidenceHit[], familyId?: string | null): EvidenceHit[] {
  const ids = queryIds(query);
  const tokens = distinctive(query);
  const ranked = rows
    .filter((row) => isOfficialHost(row.url))
    .map((row, index) => {
      const title = row.title.toLowerCase();
      const blob = `${row.title} ${row.body}`.toLowerCase();
      let score = 0;
      for (const id of ids) {
        if (blob.includes(id)) score += 100;
      }
      for (const token of tokens) {
        if (title.includes(token)) score += 10;
      }
      const lane = (row as EvidenceHit & { lane?: string }).lane;
      if (lane === "bm25" || lane === "both") score += 5;
      if (familyId && blob.includes(`family:${familyId}`)) score += 1;
      return { row, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, 5).map((item) => item.row);
}

async function cohereRerank(query: string, rows: EvidenceHit[], key: string): Promise<EvidenceHit[] | null> {
  const documents = rows.map((row) => `${row.title}\n${row.body}`.slice(0, 1500));
  const res = await fetch("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "rerank-v3.5",
      query: query.slice(0, 1000),
      documents,
      top_n: Math.min(5, rows.length),
    }),
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: { index?: number }[] };
  const results = json.results;
  if (!Array.isArray(results) || !results.length) return null;
  const out: EvidenceHit[] = [];
  for (const hit of results) {
    const index = hit.index;
    if (typeof index !== "number" || !rows[index]) continue;
    if (!isOfficialHost(rows[index].url)) continue;
    out.push(rows[index]);
  }
  return out.length ? out : null;
}

/** Gated second stage. Never calls Gemini. Frozen local hits are not passed in. */
export async function rerankCandidates(
  query: string,
  rows: EvidenceHit[],
  familyId?: string | null,
): Promise<EvidenceHit[]> {
  const official = rows.filter((row) => isOfficialHost(row.url)).slice(0, 20);
  if (!official.length) return [];
  const key = process.env.RERANK_API_KEY || process.env.COHERE_API_KEY;
  if (key) {
    try {
      const ranked = await cohereRerank(query, official, key);
      if (ranked?.length) return ranked;
    } catch (err) {
      console.warn("[rerank] cross-encoder failed", err instanceof Error ? err.message : err);
    }
  }
  console.info("[rerank] feature-rerank");
  return featureRerank(query, official, familyId);
}
