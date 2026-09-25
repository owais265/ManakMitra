import { checkBrand, checkLicence, type VerifyVerdict } from "./verify-cert.ts";

export type StatedFact = { label: string; value: string };

export type ReadinessSheet = {
  query: string;
  verdict: VerifyVerdict;
  licence: VerifyVerdict | null;
  related: string[];
  stated: StatedFact[];
  open: string[];
};

const FACTS: { label: string; pattern: RegExp }[] = [
  { label: "Power", pattern: /\b(\d+(?:\.\d+)?)\s*w\b/i },
  { label: "Voltage", pattern: /\b(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\s*v(?:ac|dc)?\b/i },
  { label: "Frequency", pattern: /\b(\d+(?:\.\d+)?)\s*hz\b/i },
  { label: "Cap", pattern: /\b(b22|e27|e14|b15)\b/i },
  { label: "Colour", pattern: /\b(\d{3,5})\s*k\b/i },
];

export function statedFacts(text: string): StatedFact[] {
  const facts: StatedFact[] = [];
  for (const fact of FACTS) {
    const match = fact.pattern.exec(text);
    if (match) facts.push({ label: fact.label, value: match[1] || match[0] });
  }
  return facts;
}

export function readinessSheet(query: string, licenceRaw = ""): ReadinessSheet {
  const verdict = checkBrand(query);
  const licence = licenceRaw.trim() ? checkLicence(licenceRaw) : null;
  const related = verdict.marks.slice(1);
  const stated = statedFacts(query);
  const open: string[] = [];

  if (verdict.status === "not-found" || verdict.status === "invalid") open.push(verdict.detail);
  if (verdict.status === "unclear") open.push(verdict.detail);
  if (verdict.marks.length > 1) {
    open.push("More than one standard is pinned. The sheet does not pick a clause or a part number for you.");
  }
  if (!licence) {
    open.push("No licence number was entered, so the mark itself was not checked.");
  } else if (licence.status !== "format-ok") {
    open.push(licence.detail);
  } else {
    open.push(`${licence.marks[0]} has the right shape. The live BIS register was not opened.`);
  }
  if (stated.length) {
    open.push("Figures you typed are shown as your words. They are not scored against a clause.");
  }
  open.push("Paid clause text is not compared, and a compliance percentage is not calculated.");

  return { query, verdict, licence, related, stated, open };
}
