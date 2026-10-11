import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceHit } from "@/lib/rag-types";
import { isOfficialHost } from "@/lib/official-hosts";

const DB_PATH = join(process.cwd(), "data/bis-corpus.sqlite");

const GENERIC = new Set(
  "hallmarking hallmark centre center laboratory laboratories private limited services certification testing research specification revision department guidelines notification gazette amendment requirements products product standard indian assaying enterprises building floor pvt labs lab scheme registration compulsory".split(
    " ",
  ),
);

const STOP = new Set(
  "a an the of for to in on and or is are with from by as at be this that your what how can do get apply bis indian standard standards about please tell me kya hai ke ki ka ko se mein aur which under list show give related process scheme published title according laboratory address status covers record matches mention mentions extract catalogue october cites there does say says line catalogue".split(
    " ",
  ),
);

const KINDS = new Set<EvidenceHit["kind"]>([
  "standard",
  "product",
  "process",
  "lab",
  "hallmark",
  "crs",
  "faq",
  "consumer",
  "link",
]);

function tokens(query: string): string[] {
  const raw = query.toLowerCase().match(/[a-z0-9]{3,}|[\u0900-\u097f]{2,}/gi) || [];
  const out: string[] = [];
  for (const t of raw) {
    if (STOP.has(t) || t.length < 4) continue;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 6);
}

function quote(token: string): string {
  return `"${token.replace(/"/g, "")}"*`;
}

function asKind(kind: string): EvidenceHit["kind"] {
  return KINDS.has(kind as EvidenceHit["kind"]) ? (kind as EvidenceHit["kind"]) : "link";
}

type Row = { kind: string; title: string; body: string; url: string; is_number: string | null };

async function readRows(match: string): Promise<Row[]> {
  if (!existsSync(DB_PATH) || !match.trim()) return [];
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const stmt = db.prepare(`
      SELECT d.kind, d.title, d.body, d.url, d.is_number
      FROM docs_fts
      JOIN docs d ON d.id = docs_fts.rowid
      WHERE docs_fts MATCH ?
      LIMIT 20
    `);
    return stmt.all(match) as Row[];
  } finally {
    db.close();
  }
}

function wordIn(hay: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${token}s?(?:[^a-z0-9]|$)`, "i").test(hay);
}

function precise(query: string, row: Row, toks: string[]): boolean {
  const title = row.title.toLowerCase();
  const isn = (query.match(/\b(\d{3,6})\b/) || [])[1];
  if (isn && (row.is_number === isn || title.includes(isn))) return true;
  const nameToks = toks.filter((t) => t.length >= 4);
  if (!nameToks.length) return false;
  const skip = new Set(["manual", "product", "guideline", "sampling", "grouping", "scheme", "inspection", "works", "standard", "standards"]);
  const distinctive = nameToks.filter((t) => !skip.has(t));
  if (distinctive.length && !distinctive.every((t) => wordIn(title, t))) return false;
  const inTitle = nameToks.filter((t) => wordIn(title, t));
  const longest = [...nameToks].sort((a, b) => b.length - a.length)[0];
  if (longest && longest.length >= 6 && wordIn(title, longest)) return inTitle.length >= 1;
  return inTitle.length >= 2;
}

function rank(row: Row, toks: string[], query: string, isn?: string): number {
  const title = row.title.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  if (isn && (row.is_number === isn || title.includes(isn))) score += 50;
  for (const t of toks) {
    if (title.includes(t)) score += t.length;
  }
  if (/standard/.test(q) && row.kind === "standard") score += 25;
  if (/laborator|\blab\b/.test(q) && row.kind === "lab") score += 25;
  if (/hallmark|huid|jewell|ahc/.test(q) && row.kind === "hallmark") score += 25;
  if (/crs|registration|fmcs/.test(q) && (row.kind === "crs" || row.kind === "process")) score += 15;
  if (/product manual|sampling guideline|grouping guideline|scheme of inspection/.test(q) && row.kind === "product") score += 40;
  return score;
}

/** Top precise rows from the 5 Oct extract. Empty when the query is not in that corpus. */
export async function searchBisCorpus(query: string): Promise<EvidenceHit[]> {
  const toks = tokens(query);
  const isMatch = query.match(/\bIS(?:\s*\/\s*(?:ISO|IEC))?\s*(\d{3,6})\b/i);
  const isn = isMatch?.[1];
  const nameToks = toks.filter((t) => t.length >= 4 && !GENERIC.has(t));
  const lead = (nameToks.length ? nameToks : toks.filter((t) => t.length >= 4)).sort((a, b) => b.length - a.length);
  const q = query.toLowerCase();
  const wantsManual = /product manual|sampling guideline|grouping guideline|scheme of inspection/.test(q);
  const kindFilter = wantsManual
    ? "product"
    : /compulsory|qco\b|scheme-?\s*x/.test(q)
      ? "product"
      : /guideline|surveillance|grant of licence|grant of license|non-conformity|unsatisfactory/.test(q)
        ? "process"
        : "";
  let rows: Row[] = [];
  try {
    if (isn) rows = await readRows(`is_number:${isn}`);
    if (lead.length && rows.length < 3) {
      const skip = new Set(["manual", "product", "guideline", "sampling", "grouping", "scheme", "inspection", "works", "standard", "standards"]);
      const distinctive = lead.filter((t) => !skip.has(t));
      const ftsToks = (distinctive.length ? distinctive : lead).slice(0, 3);
      const tokenQuery = ftsToks.map(quote).join(" AND ");
      const phrase = kindFilter ? `kind:${kindFilter} AND ${tokenQuery}` : tokenQuery;
      let more = await readRows(phrase);
      if (!more.length && lead.length > 1) {
        const one = kindFilter ? `kind:${kindFilter} AND ${quote(lead[0])}` : quote(lead[0]);
        more = await readRows(one);
      }
      const seen = new Set(rows.map((r) => r.title));
      for (const row of more) {
        if (!seen.has(row.title)) rows.push(row);
      }
    }
  } catch {
    return [];
  }
  const ranked = rows
    .filter((row) => row.url && isOfficialHost(row.url) && precise(query, row, lead.length ? lead : toks))
    .map((row) => ({ row, score: rank(row, lead.length ? lead : toks, query, isn) }))
    .sort((a, b) => b.score - a.score);
  const hits: EvidenceHit[] = [];
  for (const { row, score } of ranked) {
    if (score <= 0) continue;
    hits.push({
      kind: asKind(row.kind),
      title: row.title.slice(0, 240),
      body: row.body.slice(0, 700),
      url: row.url,
      score: 0.4,
    });
    if (hits.length >= 2) break;
  }
  return hits;
}
