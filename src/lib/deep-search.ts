import type { EvidenceHit, Retrieval } from "./rag-types.ts";

export type DeepVerdict = "agree" | "local-lock" | "split" | "one-lane" | "empty";

export type DeepReport = {
  merged: Retrieval;
  localRows: number;
  hybridRows: number;
  agreed: string[];
  held: string[];
  verdict: DeepVerdict;
  note: string;
};

function isNumbers(text: string): string[] {
  const out: string[] = [];
  const re = /\bIS[\s/.:-]*(\d{3,6})\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) out.push(match[1]);
  return out;
}

function hitNumbers(hit: EvidenceHit): string[] {
  return isNumbers(`${hit.title}\n${hit.body}`);
}

function unique(nums: string[]): string[] {
  return [...new Set(nums)];
}

/** Keep a local lock. Add a hybrid row only when it does not name a different standard. */
export function crossVerify(local: Retrieval, hybrid: Retrieval): DeepReport {
  const localIs = unique(local.hits.flatMap(hitNumbers));
  const hybridIs = unique(hybrid.hits.flatMap(hitNumbers));
  const agreed = localIs.filter((n) => hybridIs.includes(n));
  const localOnly = localIs.filter((n) => !hybridIs.includes(n));
  const hybridOnly = hybridIs.filter((n) => !localIs.includes(n));
  const locked = local.hits.filter((hit) => hit.score >= 0.45);
  const lockedTitles = new Set(locked.map((hit) => hit.title));
  const hybridTitles = new Set(hybrid.hits.map((hit) => hit.title));
  const shared = local.hits.filter((hit) => hybridTitles.has(hit.title) && !lockedTitles.has(hit.title));
  const hybridSafe = hybrid.hits.filter((hit) => {
    if (lockedTitles.has(hit.title) || shared.some((row) => row.title === hit.title)) return false;
    const nums = hitNumbers(hit);
    if (locked.length && nums.some((n) => !localIs.includes(n))) return false;
    if (!locked.length && localOnly.length && nums.some((n) => hybridOnly.includes(n))) return false;
    return true;
  });
  const mergedHits: EvidenceHit[] = [];
  for (const hit of [...locked, ...shared, ...local.hits, ...hybridSafe]) {
    if (mergedHits.some((row) => row.title === hit.title)) continue;
    mergedHits.push(hit);
    if (mergedHits.length >= 8) break;
  }
  let verdict: DeepVerdict = "empty";
  if (!mergedHits.length) verdict = "empty";
  else if (locked.length) verdict = "local-lock";
  else if (agreed.length) verdict = "agree";
  else if (localOnly.length && hybridOnly.length) verdict = "split";
  else verdict = "one-lane";
  const held = verdict === "split" ? [...localOnly, ...hybridOnly] : hybridOnly;
  const note =
    verdict === "agree"
      ? `CROSS-CHECK: both searches name IS ${agreed.join(", IS ")}. Lead with that row. Do not add a fee or a second standard.`
      : verdict === "local-lock"
        ? `CROSS-CHECK: the local pack locked the top row. Hybrid did not replace it. Agreed: ${agreed.join(", ") || "the locked title"}. Do not add a fee.`
        : verdict === "split"
          ? `CROSS-CHECK: the two searches named different standards (${held.map((n) => `IS ${n}`).join(", ")}). Ask which product they mean. Do not pick one.`
          : verdict === "empty"
            ? "CROSS-CHECK: neither search had a row. Say the catalogue has no row."
            : "CROSS-CHECK: only one search had rows. Use those rows only. Do not add a fee.";
  return {
    merged: {
      query: local.query || hybrid.query,
      hits: mergedHits,
      mode: local.hasEvidence ? local.mode : hybrid.mode,
      confidence: verdict === "agree" || verdict === "local-lock" ? "high" : mergedHits.length ? "medium" : "low",
      hasEvidence: mergedHits.length > 0 && (local.hasEvidence || hybrid.hasEvidence),
      grounding: mergedHits.length > 0 && (local.grounding === "verified" || hybrid.grounding === "verified") ? "verified" : "refuse",
    },
    localRows: local.hits.length,
    hybridRows: hybrid.hits.length,
    agreed,
    held,
    verdict,
    note,
  };
}
