import { matchProductFamily } from "./product-playbook.ts";

export type ChatTurn = { role?: string; text?: string };

export type RewriteDebug = {
  original: string;
  rewritten: string;
  isFollowCue: boolean;
  foldedFamily: string | null;
  foldedIs: string[];
  switchedFamily: string | null;
};

const IS_RE = /\bIS[\s/.:-]*(\d+)(?!\d)(?!\s*(?:k|kt|carat|karat)\b)/gi;

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
  "iske",
  "iski",
  "isko",
  "usko",
  "now",
  "tell",
  "then",
  "me",
  "the",
  "my",
  "for",
  "this",
  "that",
  "kya",
  "hai",
  "hain",
  "ka",
  "ki",
  "ke",
  "pe",
  "par",
  "give",
  "a",
  "an",
  "of",
  "to",
  "i",
  "am",
  "its",
  "it",
  "do",
  "did",
  "need",
  "needs",
  "what",
  "how",
  "where",
  "when",
  "which",
  "in",
  "on",
  "about",
  "regarding",
  "just",
  "only",
  "some",
  "any",
  "your",
  "you",
  "we",
  "our",
  "with",
  "from",
  "is",
  "are",
  "was",
  "be",
  "by",
  "bhi",
  "se",
  "ko",
  "ye",
  "yeh",
  "woh",
  "vo",
  "so",
  "up",
]);

/** A new turn that names sport, food, or health is never a follow-up. */
const TOPIC_BREAK =
  /\b(ipl|cricket|biryani|recipe|cook|fever|prescribe|share price|movie|film|football|world cup|horoscope)\b|who won (the )?(match|game|ipl)/i;

const CONTINUE_SIGNAL = new Set([
  "exact",
  "exactly",
  "detail",
  "details",
  "elaborate",
  "expand",
  "explain",
  "continue",
  "roadmap",
  "roadmaps",
  "further",
  "specific",
  "specifics",
  "precise",
  "clearly",
  "full",
  "complete",
  "documents",
  "document",
  "papers",
  "inspection",
  "sample",
  "samples",
  "testing",
  "timeline",
  "information",
  "info",
  "vistaar",
  "vistara",
  "jaankari",
  "jankari",
  "poora",
  "pura",
  "poori",
  "poore",
  "zyada",
  "adhik",
  "certification",
  "certificate",
  "certificates",
  "whole",
]);

const ANCHOR_BIS =
  /\b(certif\w*|standards?|manufactur\w*|isi\b|bis\b|schemes?|hallmark\w*|licen[cs]es?|labs?|laborator(?:y|ies)|pet\b|bootels?|bottles?|plastic|qco\b|crs\b|marks?|inspections?|testing|products?|road\s*maps?|process(?:es)?|fees?|apply|application)\b/i;

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

function normTok(token: string): string {
  if (/^d[ae]{1,2}t[aei]+l/.test(token) || token === "dtail" || token === "dtails" || token === "deatiles" || token === "deatils") {
    return "detail";
  }
  if (token === "excat" || token === "exatc" || token === "exactt") return "exact";
  if (token === "roadmp" || token === "rodmap") return "roadmap";
  if (token === "certfication" || token === "certifcation" || token === "certtifcation") return "certification";
  return token;
}

/**
 * A short turn that only asks to continue ("exact details", "poora batao").
 * A named product, an IS number, or a hard off-topic word is not a continuation.
 */
export function isPureContinuation(query: string): boolean {
  const q = query.trim();
  if (!q || q.length > 180) return false;
  if (TOPIC_BREAK.test(q)) return false;
  if (extractIsNumbers(q).length) return false;
  if (matchProductFamily(q)) return false;
  const toks = tokenize(q);
  if (!toks.length || toks.length > 12) return false;
  let signal = false;
  for (const raw of toks) {
    const token = normTok(raw);
    if (CONTINUE_SIGNAL.has(token) || ALL_CUE_SET.has(token)) {
      signal = true;
      continue;
    }
    if (FILLERS.has(token) || FILLERS.has(raw)) continue;
    return false;
  }
  return signal;
}

/** Cue-only follow-up, or a detail ellipsis. Still false when this turn names its own product. */
export function isContinuation(query: string): boolean {
  return isFollowCue(query) || isPureContinuation(query);
}

/**
 * Last user question that was not itself a follow-up.
 * Assistant prose is ignored so a catalogue card cannot become the next subject.
 */
export function topicAnchor(history?: ChatTurn[]): string {
  if (!history?.length) return "";
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn || turn.role === "assistant" || typeof turn.text !== "string") continue;
    const text = turn.text.trim();
    if (!text || isContinuation(text)) continue;
    const cleaned = text.replace(IS_TOKEN, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    if (cleaned) return cleaned;
  }
  return "";
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

export type TurnSlot = {
  product: string | null;
  scheme: string | null;
  city: string | null;
};

const IS_TOKEN = /\bIS[\s/.:-]*\d{3,6}\b/gi;

function withoutIs(text: string): string {
  return text.replace(IS_TOKEN, " ");
}

/** Last few turns only. A huge body cannot steer follow-up retrieval. */
export function boundHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return [];
  const out: ChatTurn[] = [];
  for (const turn of history.slice(-8)) {
    if (!turn || typeof turn !== "object") continue;
    const raw = (turn as ChatTurn).text;
    const text = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 400) : "";
    if (!text) continue;
    const role = (turn as ChatTurn).role === "assistant" ? "assistant" : "user";
    out.push({ role, text });
  }
  return out;
}

/** Product, scheme, and a PIN. Never an IS number from an earlier turn. */
export function slotFromHistory(history?: ChatTurn[]): TurnSlot {
  const empty: TurnSlot = { product: null, scheme: null, city: null };
  if (!history?.length) return empty;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (!turn || typeof turn.text !== "string") continue;
    const raw = turn.text.trim();
    if (!raw) continue;
    const text = withoutIs(raw);
    const family = matchProductFamily(text);
    const city = text.match(/(?<!\d)([1-9]\d{5})(?!\d)/)?.[1] ?? null;
    if (!family && !city) continue;
    const product = family
      ? family.aliases.find((alias) => text.toLowerCase().includes(alias.toLowerCase())) || family.id
      : null;
    return {
      product,
      scheme: family?.scheme ?? null,
      city,
    };
  }
  return empty;
}

/**
 * A continuation reuses the last real user question, never an earlier IS number.
 * A new product, a new IS number, or an off-topic line is returned unchanged.
 */
export function followRetrieval(query: string, history?: ChatTurn[]): string {
  const q = query.trim();
  if (!q || !isContinuation(q) || TOPIC_BREAK.test(q)) return q;
  const anchor = topicAnchor(history);
  if (!anchor) return q;
  if (!ANCHOR_BIS.test(anchor) && !matchProductFamily(anchor)) return q;
  const anchorFamily = matchProductFamily(anchor);
  const queryFamily = matchProductFamily(q);
  if (queryFamily && anchorFamily && queryFamily.id !== anchorFamily.id) return q;
  const city = anchor.match(/(?<!\d)([1-9]\d{5})(?!\d)/)?.[1] ?? "";
  const prefix = city && !anchor.includes(city) ? `${anchor} ${city}` : anchor;
  return `${prefix} ${q}`.replace(IS_TOKEN, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}
