import type { Retrieval } from "@/lib/retrieve";

const TTL_MS = 60_000;
const store = new Map<string, { at: number; value: Retrieval }>();

export function retrievalCacheKey(desk: string, query: string): string {
  const norm = query.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
  return `${desk}:${norm}`;
}

export function cacheGet(key: string, now = Date.now()): Retrieval | null {
  const row = store.get(key);
  if (!row) return null;
  if (now - row.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return row.value;
}

export function cacheSet(key: string, value: Retrieval, now = Date.now()): void {
  store.set(key, { at: now, value });
}

export function resetRetrievalCache(): void {
  store.clear();
}
