import type { Retrieval } from "@/lib/retrieve";

const TTL_MS = 60_000;
const MAX_KEYS = 200;
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
  if (store.size >= MAX_KEYS) {
    for (const [cached, row] of store) {
      if (now - row.at > TTL_MS) store.delete(cached);
    }
  }
  if (store.size >= MAX_KEYS && !store.has(key)) {
    let oldestKey = "";
    let oldestAt = Infinity;
    for (const [cached, row] of store) {
      if (row.at < oldestAt) {
        oldestAt = row.at;
        oldestKey = cached;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { at: now, value });
}

export function resetRetrievalCache(): void {
  store.clear();
}
