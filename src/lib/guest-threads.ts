export type MemoryTurn = {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: string;
};

export type GuestThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: MemoryTurn[];
};

const KEY = "mm_guest_threads";

export function slimTurns(
  messages: { id: string; role: string; text: string; timestamp: string; isStreaming?: boolean }[],
): MemoryTurn[] {
  const turns: MemoryTurn[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "ai") continue;
    if (message.isStreaming) continue;
    const text = message.text.replace(/\u0000/g, "").trim();
    if (!text) continue;
    turns.push({
      id: message.id.slice(0, 80),
      role: message.role,
      text: text.slice(0, 4000),
      timestamp: message.timestamp.slice(0, 40),
    });
  }
  return turns.slice(-40);
}

export function loadGuestThreads(): GuestThread[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestThread[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((thread) => thread && typeof thread.id === "string" && Array.isArray(thread.messages));
  } catch {
    return [];
  }
}

export function upsertGuestThread(thread: GuestThread): GuestThread[] {
  const next = [thread, ...loadGuestThreads().filter((item) => item.id !== thread.id)].slice(0, 20);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // The tab is full. Keep the in-memory list; the tab close still drops it.
  }
  return next;
}

export function clearGuestThreads(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
