/** How a reply should look. Does not retrieve and does not invent a row. */

const FACT =
  /\b(is\s*\d|isi|crs|bis|huid|hallmark|certif|licen[cs]e|labs?|standards?|qco|fmcs|manak|fees?|portal|complaint|jewell|cement|fan|helmet|laptop|gold|water|toy|switch|scheme)\b/i;

const SOCIAL =
  /^(hi|hello|hey|thanks|thank you|who are you|what can you do|good (morning|evening|night)|namaste|namaskar|namaskaram|shukriya|dhanyavad|dhanyavaad|ok|okay|bye|theek hai|thankyou)\b/i;

const LIST =
  /\b(bullets?|points?|point[- ]wise|numbered|in points|list them|बिंदु|अंकों में|পয়েন্ট|புள்ளி|పాయింట్|मुद्दे|नुक्ते)\b/i;

export function wantsList(query: string): boolean {
  return LIST.test(query);
}

/** Separate asks in one message. One question stays 1. */
export function askCount(query: string): number {
  const lines = query
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines.filter((line) => /^\d+[\).\]]\s+\S/.test(line) || /^[-*•]\s+\S/.test(line));
  if (numbered.length >= 2) return Math.min(numbered.length, 8);
  const questions = query
    .split("?")
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  if (questions.length >= 2) return Math.min(questions.length, 6);
  return 1;
}

/**
 * Source card only when the question is a BIS fact.
 * A greeting, a thanks, or a bare "example" does not get one.
 * A real product or standard question does, even if it also says hello.
 */
export function sourcesBelong(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (FACT.test(q)) return true;
  if (SOCIAL.test(q)) return false;
  if (/^(example|for example|ek example|give an example|sirf example)\b/i.test(q)) return false;
  return q.split(/\s+/).length >= 4;
}

/** Extra lines for the model. The evidence block stays the source of truth. */
export function shapeNote(query: string): string {
  const list = wantsList(query);
  const count = askCount(query);
  const sources = sourcesBelong(query);
  return [
    "SHAPE (how to write, not what is true):",
    list
      ? "- The user asked for points. Use a short bullet list, one fact per line."
      : "- The user did not ask for points. Write short paragraphs. No title line. No bold heading.",
    count > 1
      ? `- The user asked ${count} separate points. Answer every point, in that order. Do not stop after the first. About 40 words for each point.`
      : "- One question. Answer that question only. Stay under 130 words.",
    "- Be polite and plain. The facts stay the same in every language. Only the sentences change.",
    sources
      ? "- This question needs sources. After the prose, one [SOURCE] line for each EVIDENCE row you actually used, at most 4. Skip a row that does not answer this question."
      : "- This question does not need a source card. Do not emit [SOURCE]. Do not hang an unrelated link on the reply.",
  ].join("\n");
}
