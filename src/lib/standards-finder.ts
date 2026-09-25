import {
  glossIndic,
  listProductFamilies,
  type ProductFamily,
  type SchemeKind,
} from "./product-playbook.ts";

export type StandardHit = {
  id: string;
  scheme: SchemeKind | null;
  marks: string[];
  note: string | null;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(query: string, alias: string): boolean {
  if (/[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F]/.test(alias)) {
    return query.toLowerCase().includes(alias.toLowerCase());
  }
  const words = alias.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const last = words[words.length - 1];
  const head = words.slice(0, -1).map(escapeRe).join("\\s+");
  const body = head ? `${head}\\s+${escapeRe(last)}` : escapeRe(last);
  return new RegExp(`\\b${body}s?\\b`, "i").test(query);
}

export function schemeName(scheme: SchemeKind | null): string | null {
  if (scheme === "isi") return "ISI · Scheme-I";
  if (scheme === "crs") return "CRS · Scheme-II";
  if (scheme === "hallmark") return "Hallmark";
  return null;
}

export function findStandards(query: string): StandardHit[] {
  const text = query.normalize("NFKC").trim().slice(0, 160);
  if (text.length < 2) return [];
  const q = glossIndic(text.replace(/halll+mark|hallmrk|hall\s+mark/gi, "hallmark"));
  const numbers = [...q.matchAll(/\b(?:IS[\s/.-]*)?(\d{3,6})\b/gi)].map((match) => match[1]);
  const families = listProductFamilies();
  const hits: ProductFamily[] = [];
  const seen = new Set<string>();
  const push = (family: ProductFamily) => {
    if (seen.has(family.id)) return;
    seen.add(family.id);
    hits.push(family);
  };
  if (numbers.length) {
    for (const family of families) {
      if (family.is.some((n) => numbers.includes(n))) push(family);
    }
  }
  for (const family of families) {
    if (family.aliases.some((alias) => hasAlias(q, alias))) push(family);
  }
  return hits.slice(0, 6).map((family) => ({
    id: family.id.replace(/-/g, " "),
    scheme: family.scheme,
    marks: family.is.map((n) => `IS ${n}`),
    note: family.disambiguate && !numbers.length ? family.disambiguate : null,
  }));
}
