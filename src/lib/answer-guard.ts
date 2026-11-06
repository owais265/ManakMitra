/**
 * Post-answer lock. The model may only name an IS number that is already in
 * the trusted pack rows, and only link an official BIS host or a URL that
 * is already on those rows. Anything else is replaced by the pack fallback.
 */
import { isOfficialHost } from "./official-hosts.ts";

const IS_RE = /\bIS[\s/.-]*(\d{3,6})\b/gi;
const URL_RE = /https?:\/\/[^\s)\]>'"]+/gi;

export function extractIsNumbers(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(IS_RE)) out.add(match[1]);
  return [...out];
}

export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_RE)].map((match) => match[0].replace(/[.,;]+$/, ""));
}

function tooThin(text: string): boolean {
  const body = text.replace(/\s+/g, " ").trim();
  if (body.length >= 80) return false;
  if (/\bIS[\s/.-]*\d{3,6}\b/i.test(body)) return false;
  if (/https?:\/\//i.test(body)) return false;
  return true;
}

export function guardSpoken(spoken: string, trusted: string, fallback: string): string {
  const text = spoken.trim();
  if (!text || tooThin(text)) return fallback;
  const allowed = new Set(extractIsNumbers(trusted));
  const invented = extractIsNumbers(text).filter((number) => !allowed.has(number));
  if (invented.length) return fallback;
  const hay = trusted.toLowerCase();
  for (const url of extractUrls(text)) {
    if (isOfficialHost(url)) continue;
    if (hay.includes(url.toLowerCase())) continue;
    return fallback;
  }
  return text;
}

/** A numbered case keeps the reply. An IS number or link that is not in the pack is blanked, not used as a reason to throw the whole answer away. */
export function guardCase(spoken: string, trusted: string, fallback: string): string {
  const text = spoken.trim();
  if (!text || tooThin(text)) return fallback;
  const allowed = new Set(extractIsNumbers(trusted));
  const hay = trusted.toLowerCase();
  let next = text.replace(IS_RE, (full, number: string) => (allowed.has(number) ? full : "a standard that is not in this pack"));
  next = next.replace(URL_RE, (url) => {
    const clean = url.replace(/[.,;]+$/, "");
    if (isOfficialHost(clean) || hay.includes(clean.toLowerCase())) return url;
    return "";
  });
  next = next.replace(/[ \t]{2,}/g, " ").trim();
  return next || fallback;
}

const FILE_CLAIM =
  /\b(file|document|charter|pdf|page|attached|excerpt|docx|image|photo|png|paragraph|section|word)\b/i;

/** A sentence that claims to describe the attached file may not name an IS number the file does not contain. */
export function guardFileClaims(spoken: string, fileText: string): string {
  const allowed = new Set(extractIsNumbers(fileText));
  return spoken
    .split(/(\n+)/)
    .map((part) => {
      if (!FILE_CLAIM.test(part)) return part;
      IS_RE.lastIndex = 0;
      return part.replace(IS_RE, (full, number: string) =>
        allowed.has(number) ? full : "a number that is not in the attached file",
      );
    })
    .join("");
}

/** A file answer stays a file answer. An invented IS number is blanked. The catalogue card is not substituted. */
export function guardFileSpoken(spoken: string, fileText: string, packTrusted: string): string {
  const text = spoken.trim();
  if (!text) return "The attached file was read, but no answer was produced. Nothing was guessed.";
  let next = guardFileClaims(text, fileText);
  const allowed = new Set([...extractIsNumbers(fileText), ...extractIsNumbers(packTrusted)]);
  IS_RE.lastIndex = 0;
  next = next.replace(IS_RE, (full, number: string) => (allowed.has(number) ? full : "a standard that is not in this pack"));
  const hay = `${fileText}\n${packTrusted}`.toLowerCase();
  URL_RE.lastIndex = 0;
  next = next.replace(URL_RE, (url) => {
    const clean = url.replace(/[.,;]+$/, "");
    if (isOfficialHost(clean) || hay.includes(clean.toLowerCase())) return url;
    return "";
  });
  return next.replace(/[ \t]{2,}/g, " ").trim() || "The attached file was read, but no answer was produced. Nothing was guessed.";
}
