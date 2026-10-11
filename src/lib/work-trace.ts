import { isOfficialHost } from "@/lib/official-hosts";
import { isHallmarkSchemeMix, matchProductFamily, shouldClarify } from "@/lib/product-playbook";
import type { Retrieval } from "@/lib/retrieve";

export type WorkStep = {
  id: string;
  label: string;
  detail: string;
  ms: number;
};

export type GraphStop = {
  lane: "product" | "standard" | "source" | "note";
  text: string;
  href?: string;
};

const KYS = "https://standards.bis.gov.in/website/know-your-standards";

export function buildStops(query: string, retrieved: Retrieval): GraphStop[] {
  const family = matchProductFamily(query);
  const namedIs = /\bIS[\s/.-]*\d+/i.test(query);
  const product = family?.aliases[0] || (namedIs ? "Named standard" : "No product named");
  const standards = retrieved.hits.filter(
    (hit) => hit.kind === "standard" || hit.kind === "product" || hit.kind === "crs",
  );
  const standard = standards.find((hit) => /Isdetails|bisconnect\/standard_review/i.test(hit.url)) || standards[0];
  const source = standard && isOfficialHost(standard.url)
    ? standard
    : retrieved.hits.find((hit) => isOfficialHost(hit.url));
  const clarify = shouldClarify(query);
  let note = "No row in this pack. The next step is the official page.";
  if (isHallmarkSchemeMix(query)) note = "Hallmark and HUID do not apply to this product.";
  else if (clarify) note = clarify.slice(0, 180);
  else if (retrieved.grounding === "refuse" && retrieved.hasEvidence) note = "A limit in the pack applies. The answer has to say that limit.";
  else if (standard) note = "Title only. No clause text and no fee.";
  else if (retrieved.hasEvidence) note = "A pack row matched. It is not a new standard number.";
  return [
    { lane: "product", text: product },
    { lane: "standard", text: standard ? standard.title.replace(/\s+/g, " ").slice(0, 140) : "No standard row" },
    {
      lane: "source",
      text: source ? source.url.replace(/^https?:\/\//, "").slice(0, 80) : "Know Your Standard",
      href: source?.url || KYS,
    },
    { lane: "note", text: note },
  ];
}
