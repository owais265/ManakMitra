/**
 * Fallback now grounded in retrieved BIS metadata (no invented IS numbers).
 */
import type { AppLang } from "@/lib/language";
import { groundedFallback } from "@/lib/retrieve";

export function getFallbackBISResponse(query: string, language: AppLang): string {
  return groundedFallback(query, language);
}
