import { matchProductFamily } from "@/lib/product-playbook";

export type ChatTurn = { role?: string; text?: string };

export type RewriteDebug = {
  original: string;
  rewritten: string;
  isFollowCue: boolean;
  foldedFamily: string | null;
  foldedIs: string[];
  switchedFamily: string | null;
};

const IS_RE = /\bIS[\s/.-]*(\d+)/gi;

/** Strong follow-up cues — kept for cue detection only. History is NOT folded. */
export const FOLLOW_CUE_STRONG = [
  "haan",
  "han",
  "ha",
  "yes",
  "yep",
  "yeah",
  "ok",
  "okay",
  "hmm",
  "fees",
  "fee",
  "cost",
  "charges",
  "charge",
  "lab",
  "labs",
  "laboratory",
  "laboratories",
  "process",
  "procedure",
  "prakriya",
  "steps",
  "step",
  "scheme",
  "apply",
  "application",
  "related",
  "allied",
  "similar",
  "theek",
  "thik",
  "kitna",
  "kahan",
  "kahaan",
  "kaise",
  "wahi",
] as const;

export const FOLLOW_CUE_WEAK = ["and", "also", "more", "aur", "k"] as const;

const FILLERS = new Set([
  "batao",
  "bata",
  "bataye",
  "please",
  "pls",
  "bhai",
  "bro",
  "ab",
  "iska",
  "uska",
  "uske",
  "uski",
  "now",
  "tell",
  "then",
  "me",
  "the",
  "my",
  "for",
  "this",
  "that",
]);

export const FOLLOW_CUE = new RegExp(
  `\\b(${[...FOLLOW_CUE_STRONG, ...FOLLOW_CUE_WEAK].join("|")})\\b`,
  "i",
);

const ALL_CUE_SET = new Set<string>([...FOLLOW_CUE_STRONG, ...FOLLOW_CUE_WEAK]);

function extractIsNumbers(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(IS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the latest turn is only cue tokens + optional fillers (fees? / haan / kitna fees). */
export function isFollowCue(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (extractIsNumbers(q).length) return false;
  if (matchProductFamily(q)) return false;
  const toks = tokenize(q);
  if (!toks.length) return false;
  let sawCue = false;
  for (const t of toks) {
    if (ALL_CUE_SET.has(t)) {
      sawCue = true;
      continue;
    }
    if (FILLERS.has(t)) continue;
    return false;
  }
  return sawCue;
}

export function isShortFollow(query: string): boolean {
  return isFollowCue(query);
}

/** History unused — each query is standalone. Kept so old call sites type-check. */
export function historyLooksBis(_history: ChatTurn[] | undefined): boolean {
  return false;
}

function emptyDebug(q: string): RewriteDebug {
  return {
    original: q,
    rewritten: q,
    isFollowCue: false,
    foldedFamily: null,
    foldedIs: [],
    switchedFamily: null,
  };
}

/**
 * No conversation fold. Retrieval uses this turn only.
 * A product name in the query pins family; a cue-only query is not rewritten with an old IS.
 */
export function rewriteQueryDebug(query: string, _history?: ChatTurn[]): RewriteDebug {
  const q = query.trim();
  if (!q) return emptyDebug(q);
  const latestFamily = matchProductFamily(q);
  const follow = isFollowCue(q);
  return {
    original: q,
    rewritten: q,
    isFollowCue: follow,
    foldedFamily: null,
    foldedIs: extractIsNumbers(q),
    switchedFamily: !follow && latestFamily ? latestFamily.id : null,
  };
}

export function rewriteQuery(query: string, _history?: ChatTurn[]): string {
  return query.trim();
}
