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

export function guardSpoken(spoken: string, trusted: string, fallback: string): string {
  const text = spoken.trim();
  if (!text) return fallback;
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
