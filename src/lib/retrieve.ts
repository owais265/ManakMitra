import type { AppLang } from "@/lib/language";
import { FALLBACK_SHELL } from "@/lib/language";
import { moreCopy } from "@/lib/more-copy";
import { RAG_VERIFIED, vectorRetrieve } from "@/lib/rag";
import { matchProductFamily, shouldClarify, isHallmarkSchemeMix } from "@/lib/product-playbook";
import { isOfficialHost } from "@/lib/official-hosts";

export type EvidenceHit = {
  kind: "standard" | "product" | "process" | "lab" | "hallmark" | "crs" | "faq" | "consumer" | "link";
  title: string;
  body: string;
  url: string;
  score: number;
};

export type Retrieval = {
  query: string;
  hits: EvidenceHit[];
  mode: "standards" | "hallmarking" | "general";
  confidence: "high" | "medium" | "low";
  hasEvidence: boolean;
  grounding: "verified" | "refuse";
};

export function retrieve(query: string): Retrieval {
  return vectorRetrieve(query);
}

/** Policy pin first; local pack is rank lock. Dense extras only if needed and HYBRID_RAG≠0. */
export async function retrieveHybrid(query: string): Promise<Retrieval> {
  const { runHybridRetrieve } = await import("@/lib/hybrid");
  return runHybridRetrieve(query);
}

export function formatEvidenceBlock(r: Retrieval): string {
  if (!r.hasEvidence) {
    return `MATCH: no
NO VERIFIED HITS in the local BIS catalogue for this query.
You MUST say the catalogue has no row for this, and you MUST NOT invent an IS number, fee, or mandatory status.
Point the user to:
- Know Your Standard: https://standards.bis.gov.in/website/know-your-standards
- Compulsory certification list: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en
- MANAK Online: https://www.manakonline.in`;
  }
  const ranked = r.hits
    .map(
      (h, i) =>
        `${i + 1}. [${h.kind}] ${h.title}\n${h.body.slice(0, 700)}\nURL: ${h.url}`,
    )
    .join("\n\n");
  const limit =
    r.grounding === "refuse"
      ? "LIMIT: a row below is a scheme or policy limit. Explain that limit in plain words, then any product or IS row that is also listed. Do not say the catalogue is empty.\n"
      : "";
  return `MATCH: yes
CATALOGUE RULE: every row below is metadata (IS id + title / official note). Full clause text of paid Indian Standards is NOT stored. Never quote a clause number that is not written here.
${limit}ANSWER SHAPE (mandatory):
- Talk to the user. First sentence answers their exact product or IS in plain words, using the matching row.
- Then at most 5 short sentences or bullets. No markdown headings. No catalogue dump. No BIS Act lecture.
- Official URLs from the rows only — never a search engine.
- If a NOTE says to disambiguate, ask that ONE question in a normal sentence. Do not pick 22K/916 or a single IS until they specify.
- If process/scheme rows exist and they asked how to apply / ISI / CRS / FMCS, print numbered steps (4–6) plus the portal URL, still in a human voice.
- CONSUMER hallmark / HUID / CARE / verify gold: CARE Verify-HUID steps only. Never jeweller registration, “no docs/fee”, “instant registration”, or “sell only AHC-hallmarked pieces”.
- JEWELLER / AHC / hallmark licence: hallmarking registration rows only.
- Never truncate manakonline.in. Never use a search-engine URL.

Ranked hits (best first):
${ranked}

If you name an IS, it MUST appear in the ranked hits. If you mention a fee, it MUST appear in a faq/process row. If a lab city is asked, only name labs in the hits. Never claim a lab is accredited for a named IS. If the user asked for a clause, do not invent clause text — use the Know Your Standard / e-Sale rows.`;
}

const JEWELLER_ASK =
  /\b(jeweller|jeweler|assaying|ahc\b|hallmark(?:ing)?\s+licen[cs]e|register as|apply as jewell)\b/i;

export const JEWELLER_STEP_FORBID =
  /Apply online as jeweller|Sell only AHC-hallmarked|Submit with no docs\/fee|Get instant registration|Register online with BIS|Approach a BIS-recognised Assaying/i;

const CONSUMER_VERIFY_STEPS = [
  "Open the BIS CARE app",
  "Tap Verify HUID",
  "Enter the 6-digit HUID on the article",
  "Match purity and jeweller name",
];

function cleanStepLabel(title: string): string {
  let s = title.replace(/^[^:]+:\s*/, "").trim();
  s = s.replace(/\bakonline\.in\b/gi, "manakonline.in");
  s = s.replace(/\bno docs\/fee\b/gi, "");
  s = s.replace(/\binstant registration\b/gi, "");
  return s.replace(/\s+/g, " ").trim();
}

function isHallmarkConsumerVerify(query: string): boolean {
  if (isHallmarkSchemeMix(query, matchProductFamily(query))) return false;
  if (/\b(huid|care app|bis\s*care)\b/i.test(query)) return true;
  if (/\b(crs|r-?number|registration number|isi mark|scheme-?i|fmcs)\b/i.test(query)) return false;
  if (/\bverify\b/i.test(query) && /gold|jewel|hallmark|huid/i.test(query)) return true;
  return false;
}

function pickProcessSteps(query: string, r: Retrieval, clarify: string | null): string[] {
  if (clarify) return [];
  const family = matchProductFamily(query);
  const jeweller = JEWELLER_ASK.test(query);
  const careOrVerify = isHallmarkConsumerVerify(query);
  const applyAsk =
    /\b(apply|application|how to|process|steps?|scheme-?i\b|isi mark|crs|fmcs|licence|license)\b/i.test(query);
  const crsAsk = /\bcrs\b|compulsory registration/i.test(query);
  const fmcsAsk = /\bfmcs\b|foreign manufacturer/i.test(query);
  const isiAsk =
    /\bisi mark|scheme-?i\b|product certification/i.test(query) ||
    (applyAsk && !jeweller && family?.scheme === "isi");

  if (!jeweller && (careOrVerify || (applyAsk && family?.id === "gold"))) {
    return CONSUMER_VERIFY_STEPS;
  }

  const processHits = r.hits.filter((h) => h.kind === "process");

  const schemeHits = processHits.filter((h) => {
    if (jeweller) return /hallmark/i.test(h.title);
    if (crsAsk) return /crs|scheme-ii|scheme-2/i.test(h.title);
    if (fmcsAsk) return /fmcs/i.test(h.title);
    if (isiAsk || applyAsk) return /scheme-i|isi mark|product certification/i.test(h.title);
    return false;
  });

  if (!schemeHits.length && !applyAsk && !jeweller) return [];

  const STEP_RANK = [
    /find the indian standard/i,
    /apply|application|submit|register online/i,
    /inspect/i,
    /test/i,
    /licence granted|grant of licence/i,
    /fee|marking/i,
  ];
  const stepSource = (
    schemeHits.length ? schemeHits : jeweller ? processHits.filter((h) => /hallmark/i.test(h.title)) : []
  ).slice(0, 6);
  stepSource.sort((a, b) => {
    const ia = STEP_RANK.findIndex((re) => re.test(a.title));
    const ib = STEP_RANK.findIndex((re) => re.test(b.title));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const filtered = stepSource
    .map((h) => cleanStepLabel(h.title))
    .filter((s) => Boolean(s) && !/no docs\/fee|instant registration|akonline/i.test(s))
    .filter((s) => jeweller || !JEWELLER_STEP_FORBID.test(s));

  if (crsAsk && filtered.length && !filtered.some((s) => /crsbis\.in/i.test(s))) {
    filtered.push("Apply on https://www.crsbis.in");
  } else if (
    (isiAsk || (applyAsk && !jeweller && family?.scheme !== "hallmark")) &&
    filtered.length &&
    !filtered.some((s) => /manakonline\.in/i.test(s))
  ) {
    filtered.push("Apply on https://www.manakonline.in");
  }
  return filtered.slice(0, 6);
}

export function groundedFallback(query: string, language: AppLang): string {
  const r = retrieve(query);
  const shell = FALLBACK_SHELL[language] || FALLBACK_SHELL.en;
  const more = moreCopy(language);
  const stripHash = (s: string) => s.replace(/^#+\s*/, "");
  const clarify = shouldClarify(query);
  const jeweller = JEWELLER_ASK.test(query);
  const careOrVerify = isHallmarkConsumerVerify(query);
  const applyAsk =
    /\b(apply|application|how to|process|steps?|scheme-?i\b|isi mark|crs|fmcs|licence|license)\b/i.test(query);
  const crsAsk = /\bcrs\b|compulsory registration/i.test(query);
  const steps = pickProcessSteps(query, r, clarify);

  const hideJeweller = !jeweller;
  const sources = new Map<string, { title: string; type: string; date: string; link: string }>();
  for (const h of r.hits) {
    if (!h.url || !isOfficialHost(h.url) || /google\.com\/search/i.test(h.url)) continue;
    if (hideJeweller && JEWELLER_STEP_FORBID.test(h.title)) continue;
    sources.set(h.url, {
      title: h.title.slice(0, 120),
      type: h.kind,
      date: RAG_VERIFIED,
      link: h.url,
    });
  }
  if (!sources.size) {
    sources.set("kys", {
      title: "Know Your Standard",
      type: "catalogue",
      date: RAG_VERIFIED,
      link: "https://standards.bis.gov.in/website/know-your-standards",
    });
  }

  const portal = crsAsk
    ? r.hits.find((h) => /crsbis\.in/i.test(h.url))?.url || "https://www.crsbis.in"
    : r.hits.find((h) => /manakonline\.in/i.test(h.url))?.url || "https://www.manakonline.in";

  const visibleHits = r.hits.filter((h) => !(hideJeweller && JEWELLER_STEP_FORBID.test(h.title)));

  const headlineHit =
    visibleHits.find((h) => h.kind === "standard" || h.kind === "product" || h.kind === "crs") ||
    visibleHits.find((h) => h.kind === "lab" || h.kind === "faq" || h.kind === "hallmark") ||
    visibleHits[0];
  const headline = headlineHit?.title.replace(/\s+/g, " ").trim() ?? "";

  const lines: string[] = [];
  if (!r.hasEvidence) {
    lines.push(stripHash(shell.refuse));
    lines.push(stripHash(shell.kysHint));
  } else if (clarify) {
    lines.push(clarify);
    visibleHits.filter((h) => h.kind !== "process").slice(0, 3).forEach((h, i) => {
      lines.push(`${i + 1}. ${h.title}`);
      if (h.url && isOfficialHost(h.url)) lines.push(`   ${h.url}`);
    });
  } else if (careOrVerify) {
    more.huidSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push(more.notLive);
    lines.push(stripHash(shell.notBody));
  } else if (steps.length && (applyAsk || jeweller)) {
    if (headline) lines.push(`${headline}.`);
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    if (portal && !/akonline/i.test(portal) && isOfficialHost(portal)) {
      if (!steps.some((s) => s.includes(portal))) lines.push(portal);
    }
    lines.push(stripHash(shell.notBody));
  } else {
    if (headline) lines.push(`${headline}.`);
    visibleHits
      .filter((h) => h.title !== headline)
      .slice(0, 3)
      .forEach((h, i) => {
        lines.push(`${i + 1}. ${h.title}`);
        if (h.url && isOfficialHost(h.url)) lines.push(`   ${h.url}`);
      });
    lines.push(stripHash(shell.notBody));
  }

  for (const src of sources.values()) {
    lines.push(`[SOURCE] ${src.title} | ${src.type} | ${src.date} | ${src.link}`);
  }
  lines.push(`[FOLLOW_UP] ${clarify ? clarify : r.hasEvidence ? shell.followYes : shell.followNo}`);
  lines.push(`[META] ${r.confidence} | ${r.mode}`);
  if (steps.length && !clarify) lines.push(`[PROCESS_STEPS] ${(careOrVerify ? more.huidSteps : steps).join(" | ")}`);
  return lines.join("\n");
}
