import type { AppLang } from "@/lib/language";
import { RAG_VERIFIED, vectorRetrieve } from "@/lib/rag";

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
};

export function retrieve(query: string): Retrieval {
  return vectorRetrieve(query);
}

export function formatEvidenceBlock(r: Retrieval): string {
  if (!r.hasEvidence) {
    return `NO VERIFIED HITS in the local BIS catalogue for this query.
You MUST refuse to invent IS numbers, fees, or mandatory status.
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
  return `CATALOGUE RULE: every row below is metadata (IS id + title / official note). Full clause text of paid Indian Standards is NOT stored. Never quote a clause number that is not written here.

Ranked hits (best first):
${ranked}

If you name an IS, it MUST appear in the ranked hits. If you mention a fee, it MUST appear in a faq/process row. If a lab city is asked, only name labs in the hits. Never claim a lab is accredited for a named IS. If the user asked for a clause, do not invent clause text — use the Know Your Standard / e-Sale rows.`;
}

export function groundedFallback(query: string, language: AppLang): string {
  const r = retrieve(query);
  const hi = language === "hi" || language === "mr";
  const refuseEn =
    "I do not have enough verified BIS evidence in the authorised catalogue for a complete product-to-standard mapping of this query.";
  const refuseHi = "Mujhe verified BIS source mein is query ka poora mapping nahi mila.";

  const sources = new Map<string, { title: string; type: string; date: string; link: string }>();
  for (const h of r.hits) {
    if (!h.url) continue;
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

  const followEn = r.hasEvidence
    ? "Would you like the official certification steps and fee figures from the BIS FAQ for this scheme?"
    : "Can you name the product more specifically, or an IS number if you have one?";
  const followHi = r.hasEvidence
    ? "Kya aap is scheme ke official certification steps / fee FAQ dekhna chahenge?"
    : "Kya aap product ka aur clearly naam, ya IS number de sakte hain?";

  const steps = r.hits
    .filter((h) => h.kind === "process")
    .slice(0, 5)
    .map((h) => h.title.replace(/^[^:]+:\s*/, "").slice(0, 40));

  const schemeHit = r.hits.find((h) => ["process", "crs", "hallmark", "product"].includes(h.kind));
  const schemeLine = schemeHit
    ? hi
      ? `संबंधित योजना (पैक से): ${schemeHit.title}`
      : `Related scheme (from pack): ${schemeHit.title}`
    : "";

  const why = (h: EvidenceHit) => {
    const line = h.body.split(/[.\n]/)[0].replace(/\s+/g, " ").trim().slice(0, 140);
    return line || h.kind;
  };

  const lines: string[] = [];
  if (hi) {
    lines.push("### मानक-मित्र — स्रोत-आधारित उत्तर");
    if (!r.hasEvidence) {
      lines.push(refuseHi);
      lines.push("आधिकारिक खोज: Know Your Standard portal.");
    } else {
      lines.push("## लागू (कैटलॉग मेटाडेटा)");
      r.hits.slice(0, 3).forEach((h, i) => {
        lines.push(`${i + 1}. **${h.title}** — ${why(h)}`);
        if (h.url) lines.push(`   ${h.url}`);
      });
      if (schemeLine) lines.push(schemeLine);
      lines.push("## यह क्या नहीं है");
      lines.push("यह कैटलॉग मेटाडेटा है, पूर्ण क्लॉज पाठ नहीं। यह लाइसेंस नहीं है और कानूनी सलाह नहीं है।");
    }
  } else {
    lines.push("### ManakMitra — source-backed answer");
    if (!r.hasEvidence) {
      lines.push(refuseEn);
      lines.push("Use the official Know Your Standard tool to look up the product, then return with the IS number.");
    } else {
      lines.push("## Applicable (catalogue metadata)");
      r.hits.slice(0, 3).forEach((h, i) => {
        lines.push(`${i + 1}. **${h.title}** — ${why(h)}`);
        if (h.url) lines.push(`   ${h.url}`);
      });
      if (schemeLine) lines.push(schemeLine);
      lines.push("## What this is not");
      lines.push("Catalogue metadata only — full clause text is not stored. This is not a licence and not legal advice.");
    }
  }

  for (const src of sources.values()) {
    lines.push(`[SOURCE] ${src.title} | ${src.type} | ${src.date} | ${src.link}`);
  }
  lines.push(`[FOLLOW_UP] ${hi ? followHi : followEn}`);
  lines.push(`[META] ${r.confidence} | ${r.mode}`);
  if (steps.length) lines.push(`[PROCESS_STEPS] ${steps.join(" | ")}`);
  return lines.join("\n");
}
