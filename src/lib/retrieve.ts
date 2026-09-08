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
  return r.hits
    .map((h, i) => `${i + 1}. [${h.kind}] ${h.title}\n${h.body.slice(0, 700)}\nURL: ${h.url}`)
    .join("\n\n");
}

export function groundedFallback(query: string, language: AppLang): string {
  const r = retrieve(query);
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

  const lines: string[] = [];
  if (language === "hi" || language === "mr") {
    lines.push("### मानक-मित्र — स्रोत-आधारित उत्तर");
    if (!r.hasEvidence) {
      lines.push(refuseHi);
      lines.push("आधिकारिक खोज: Know Your Standard portal.");
    } else {
      lines.push("नीचे केवल उपलब्ध आधिकारिक मेटाडेटा से मैच हैं। जो फीस/अनिवार्यता सूची में नहीं है, वह अनुमान नहीं है।");
      for (const h of r.hits.slice(0, 8)) {
        lines.push(`* **${h.title}** — ${h.body}`);
      }
    }
  } else {
    lines.push("### ManakMitra — source-backed answer");
    if (!r.hasEvidence) {
      lines.push(refuseEn);
      lines.push("Use the official Know Your Standard tool to look up the product, then return with the IS number.");
    } else {
      lines.push("Matches below are from the authorised BIS metadata pack (verified 2026-09-08). Titles only — full IS text is not stored.");
      for (const h of r.hits.slice(0, 8)) {
        lines.push(`* **${h.title}** — ${h.body}`);
      }
    }
  }

  for (const src of sources.values()) {
    lines.push(`[SOURCE] ${src.title} | ${src.type} | ${src.date} | ${src.link}`);
  }
  lines.push(`[FOLLOW_UP] ${language === "hi" || language === "mr" ? followHi : followEn}`);
  lines.push(`[META] ${r.confidence} | ${r.mode}`);
  if (steps.length) lines.push(`[PROCESS_STEPS] ${steps.join(" | ")}`);
  return lines.join("\n");
}
