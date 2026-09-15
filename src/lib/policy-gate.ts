/**
 * Policy gate: pin official text + URL and skip dense/sparse extras.
 * The pin rows themselves are produced in rag.ts (policyEarlyHits) so the
 * local pack remains the accuracy lock. This module names the pin and tells
 * hybrid retrieve to skip embeddings.
 */
import type { Retrieval } from "@/lib/rag-types";

const PIN_TITLE =
  /hallmark \/ huid applies only to jewellery|is number vs product — do not mix|not in this catalogue snapshot|nws \/ lrs \/ unknown portal|hypothetical \/ policy scenario — pack has no sop|what is bis —|imported products — fmcs|eco mark is a separate/i;

export function isPolicyPinned(r: Retrieval): boolean {
  const top = r.hits[0];
  if (!top) return false;
  return top.score >= 0.97 && PIN_TITLE.test(top.title);
}

export function policyPinName(r: Retrieval): string | null {
  if (!isPolicyPinned(r)) return null;
  const t = r.hits[0]?.title || "";
  if (/huid applies only to jewellery/i.test(t)) return "mix-huid";
  if (/do not mix catalogue/i.test(t)) return "typed-mismatch";
  if (/not in this catalogue/i.test(t)) return "unknown-is";
  if (/unknown portal/i.test(t)) return "fake-portal";
  if (/pack has no sop/i.test(t)) return "no-table";
  if (/what is bis/i.test(t)) return "what-bis";
  if (/fmcs/i.test(t)) return "air-fmcs";
  if (/eco mark/i.test(t)) return "ecomark";
  return "policy";
}
