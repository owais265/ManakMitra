export type RecentFile = {
  id: string;
  name: string;
  kind: "png" | "image" | "text";
  text?: string;
  dataUrl?: string;
  at: number;
};

const KEY = "mm-recent-files";
const CAP = 6;
const MAX_CHARS = 900_000;

export function pushRecent(list: RecentFile[], next: Omit<RecentFile, "id" | "at">, now = Date.now()): RecentFile[] {
  if (next.dataUrl && next.dataUrl.length > 400_000) return list;
  const id = `${next.kind}:${next.name}`;
  const row: RecentFile = { ...next, id, at: now };
  const merged = [row, ...list.filter((item) => item.id !== id)].slice(0, CAP);
  while (merged.length > 1 && JSON.stringify(merged).length > MAX_CHARS) merged.pop();
  return merged;
}

function isRecent(value: unknown): value is RecentFile {
  if (!value || typeof value !== "object") return false;
  const row = value as RecentFile;
  return typeof row.name === "string" && (row.kind === "png" || row.kind === "image" || row.kind === "text");
}

export function loadRecent(): RecentFile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isRecent).slice(0, CAP);
  } catch {
    return [];
  }
}

export function rememberRecent(file: Omit<RecentFile, "id" | "at">): RecentFile[] {
  const next = pushRecent(loadRecent(), file);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or quota */
  }
  return next;
}
