import { isOfficialHost } from "./official-hosts.ts";

export type FeedbackKind = "up" | "down" | "report";

export type FeedbackLock = { id: string; label: string; detail: string };
export type FeedbackEvidence = { title: string; url: string };

export type FeedbackPacket = {
  kind: FeedbackKind;
  query: string;
  exit: string;
  language: string;
  locks: FeedbackLock[];
  evidence: FeedbackEvidence[];
};

const KINDS = new Set<FeedbackKind>(["up", "down", "report"]);

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

/** Trust boundary for a feedback click. Drops the essay, mail, and non-official URLs. */
export function sanitizeFeedback(body: unknown): FeedbackPacket | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const raw = body as Record<string, unknown>;
  if (typeof raw.kind !== "string" || !KINDS.has(raw.kind as FeedbackKind)) return null;

  const locks: FeedbackLock[] = [];
  if (Array.isArray(raw.locks)) {
    for (const row of raw.locks) {
      if (locks.length >= 8) break;
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const item = row as Record<string, unknown>;
      locks.push({
        id: clip(item.id, 40),
        label: clip(item.label, 80),
        detail: clip(item.detail, 180),
      });
    }
  }

  const evidence: FeedbackEvidence[] = [];
  if (Array.isArray(raw.evidence)) {
    for (const row of raw.evidence) {
      if (evidence.length >= 6) break;
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const item = row as Record<string, unknown>;
      const url = clip(item.url ?? item.link, 300);
      if (!isOfficialHost(url)) continue;
      evidence.push({ title: clip(item.title, 120), url });
    }
  }

  return {
    kind: raw.kind as FeedbackKind,
    query: clip(raw.query, 500),
    exit: clip(raw.exit ?? raw.exit_note, 300),
    language: (clip(raw.language, 16).match(/^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?/) || [""])[0],
    locks,
    evidence,
  };
}
