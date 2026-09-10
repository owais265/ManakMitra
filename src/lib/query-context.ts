import { matchProductFamily } from "@/lib/product-playbook";

export type ChatTurn = { role?: string; text?: string };

const IS_RE = /\bIS[\s/.-]*(\d+)/gi;

export const FOLLOW_CUE =
  /\b(process|steps?|procedure|fee|fees|lab(?:orator(?:y|ies))?|scheme|certif|hallmark|huid|licence|license|testing|roadmap|apply|application|mandatory|qco|clause|related|haan+|ha+\b|yes|ok+|okay|kaise|batao|bataye|ab\b|iska|uska|uske|uski|now tell|and then|follow up)\b/i;

export const MICRO_FOLLOW = /^(haan+|ha+|yes|yep|ok+|okay|fees?|labs?|process|scheme|apply|related)[!.\s]*$/i;

export const PRODUCTISH =
  /\b(helmet|cement|gold|jewel|mixer|grinder|mixie|laptop|notebook|tablet|charger|adapter|pet\b|bottle|tyre|tire|steel|solar|photovoltaic|plastic|isi|crs|fmcs|qco|cooker|cable|lpg|tmt|plywood|stove|pipe|webcam|power ?bank|milk|bulb)\b|हेलमेट|सीमेंट|मिक्सर|मिक्सी|ग्राइंडर|सोना|गहना|आभूषण|लैपटॉप|चार्जर|बोतल|टायर|कुकर|केबल|प्लाई|दूध|बल्ब/i;

export function extractIsNumbers(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(IS_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

function userTexts(history: ChatTurn[] | undefined): string[] {
  return (history || [])
    .filter((m) => m?.text?.trim() && m.role !== "ai")
    .map((m) => m.text!.trim());
}

function aiTexts(history: ChatTurn[] | undefined): string[] {
  return (history || [])
    .filter((m) => m?.text?.trim() && m.role === "ai")
    .map((m) => m.text!.trim());
}

export function historyLooksBis(history: ChatTurn[] | undefined): boolean {
  const blob = [...userTexts(history), ...aiTexts(history)].join(" ");
  if (!blob) return false;
  if (PRODUCTISH.test(blob) || FOLLOW_CUE.test(blob)) return true;
  if (extractIsNumbers(blob).length) return true;
  if (/bis|indian standard|hallmark|manak|मानक|प्रमाणन/i.test(blob)) return true;
  return false;
}

/** Fold earlier product / IS into short follow-ups so retrieval still hits. */
export function rewriteQuery(query: string, history: ChatTurn[] | undefined): string {
  const q = query.trim();
  if (!q) return q;
  const users = userTexts(history);
  const ais = aiTexts(history);
  const prior = `${users.slice(-4).join(" ")} ${ais.slice(-3).join(" ")}`;
  const fromPrior = extractIsNumbers(prior);
  const fromQ = extractIsNumbers(q);
  const ids = [...new Set([...fromQ, ...fromPrior])];

  const shortFollow = (q.length < 140 && FOLLOW_CUE.test(q)) || MICRO_FOLLOW.test(q);
  const productCarry =
    q.split(/\s+/).length <= 12 && !PRODUCTISH.test(q) && (PRODUCTISH.test(prior) || Boolean(matchProductFamily(prior)));

  if (!shortFollow && !productCarry && fromQ.length) return q;
  if (!shortFollow && !productCarry && !fromPrior.length && !matchProductFamily(prior)) return q;

  const bits: string[] = [];
  for (const u of users.slice(-4)) {
    if (PRODUCTISH.test(u) || extractIsNumbers(u).length || matchProductFamily(u)) bits.push(u.slice(0, 200));
  }
  const priorFamily = matchProductFamily(prior);
  const famClause = priorFamily ? `${priorFamily.id} ${priorFamily.is.map((n) => `IS ${n}`).join(" ")}` : "";
  const idClause = ids.length ? ids.map((n) => `IS ${n}`).join(" ") : "";
  if (!bits.length && !idClause && !famClause) return q;
  return `${q}\nContext from this chat: ${bits.join(" | ")} ${idClause} ${famClause}`.trim();
}
