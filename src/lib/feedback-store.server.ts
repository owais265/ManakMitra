import pg from "pg";
import feedbackDdl from "../../migrations/0003_answer_feedback.sql?raw";
import { getServiceSupabase } from "@/lib/supabase.server";
import type { FeedbackPacket } from "@/lib/feedback-packet";
import { splitSql } from "@/lib/sql-split";

export const FEEDBACK_HOURS = 24;

let ensured: Promise<boolean> | null = null;
let failedAt = 0;

function postgresUrls(): string[] {
  const keys = ["POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"];
  const out: string[] = [];
  for (const key of keys) {
    const url = process.env[key]?.trim();
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

function safeDbError(err: unknown): string {
  const message = err instanceof Error ? err.message : "ddl failed";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://redacted").slice(0, 180);
}

async function applyDdl(url: string): Promise<void> {
  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 1_500,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    for (const stmt of splitSql(feedbackDdl)) {
      await client.query(stmt);
    }
    await client.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    client.release();
    await pool.end();
  }
}

/** Idempotent. Tries the pooler URL first, then the direct URL. */
export function ensureFeedbackTable(): Promise<boolean> {
  const urls = postgresUrls();
  if (!urls.length) return Promise.resolve(false);
  if (ensured) return ensured;
  if (Date.now() - failedAt < 60_000) return Promise.resolve(false);
  ensured = (async () => {
    let last = "ddl failed";
    for (const url of urls) {
      try {
        await applyDdl(url);
        return true;
      } catch (err) {
        last = safeDbError(err);
      }
    }
    throw new Error(last);
  })().catch((err) => {
    ensured = null;
    failedAt = Date.now();
    console.error("[feedback] table", safeDbError(err));
    return false;
  });
  return ensured;
}

const ROW = (packet: FeedbackPacket) => ({
  kind: packet.kind,
  query: packet.query,
  exit_note: packet.exit,
  language: packet.language,
  locks: packet.locks,
  evidence: packet.evidence,
});

export async function saveFeedback(packet: FeedbackPacket): Promise<{ ok: true } | { ok: false; status: number }> {
  await ensureFeedbackTable();
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, status: 503 };
  const purged = await sb.rpc("purge_answer_feedback");
  if (purged.error && !/does not exist|schema cache|PGRST202|PGRST205/i.test(purged.error.message)) {
    console.error("[feedback] purge", purged.error.message.slice(0, 180));
  }
  let inserted = await sb.from("answer_feedback").insert(ROW(packet));
  if (inserted.error && /schema cache|PGRST205/i.test(`${inserted.error.code} ${inserted.error.message}`)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    inserted = await sb.from("answer_feedback").insert(ROW(packet));
  }
  if (!inserted.error) return { ok: true };
  const missing = /does not exist|schema cache|PGRST205|42P01/i.test(`${inserted.error.code} ${inserted.error.message}`);
  if (missing) {
    const bridged = await saveFeedbackBridge(sb, packet);
    if (bridged) return { ok: true };
  }
  console.error("[feedback] insert", (inserted.error.message || "").slice(0, 180));
  return { ok: false, status: missing ? 503 : 500 };
}

/** Same 24-hour packet, on the service-role table that already exists. */
async function saveFeedbackBridge(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  packet: FeedbackPacket,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - FEEDBACK_HOURS * 60 * 60 * 1000).toISOString();
  const purged = await sb.from("query_logs").delete().lt("created_at", cutoff).like("intent", "mmfb:%");
  if (purged.error && !/does not exist|schema cache/i.test(purged.error.message)) {
    console.error("[feedback] bridge purge", purged.error.message.slice(0, 180));
  }
  const intent = `mmfb:${JSON.stringify({
    kind: packet.kind,
    exit: packet.exit,
    language: packet.language,
    locks: packet.locks,
    evidence: packet.evidence,
  })}`.slice(0, 4000);
  const inserted = await sb.from("query_logs").insert({
    query: packet.query || "(no question)",
    intent,
    refused: packet.kind !== "up",
  });
  if (inserted.error) {
    console.error("[feedback] bridge", inserted.error.message.slice(0, 180));
    return false;
  }
  return true;
}
