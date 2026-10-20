import pg from "pg";
import feedbackDdl from "../../migrations/0003_answer_feedback.sql?raw";
import { getServiceSupabase } from "@/lib/supabase.server";
import type { FeedbackPacket } from "@/lib/feedback-packet";

export const FEEDBACK_HOURS = 24;

let ensured: Promise<boolean> | null = null;

function postgresUrl(): string {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
  ).trim();
}

/** Idempotent. No-ops when this process has no Postgres URL. */
export function ensureFeedbackTable(): Promise<boolean> {
  const url = postgresUrl();
  if (!url) return Promise.resolve(false);
  if (!ensured) {
    ensured = (async () => {
      const pool = new pg.Pool({
        connectionString: url,
        max: 1,
        connectionTimeoutMillis: 8_000,
        ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
      });
      try {
        await pool.query(feedbackDdl);
        return true;
      } finally {
        await pool.end();
      }
    })().catch((err) => {
      ensured = null;
      const message = err instanceof Error ? err.message : "ddl failed";
      console.error("[feedback] table", message.slice(0, 180));
      return false;
    });
  }
  return ensured;
}

export async function saveFeedback(packet: FeedbackPacket): Promise<{ ok: true } | { ok: false; status: number }> {
  await ensureFeedbackTable();
  const sb = getServiceSupabase();
  if (!sb) return { ok: false, status: 503 };
  const purged = await sb.rpc("purge_answer_feedback");
  if (purged.error && !/does not exist|schema cache|PGRST202|PGRST205/i.test(purged.error.message)) {
    console.error("[feedback] purge", purged.error.message.slice(0, 180));
  }
  const inserted = await sb.from("answer_feedback").insert({
    kind: packet.kind,
    query: packet.query,
    exit_note: packet.exit,
    language: packet.language,
    locks: packet.locks,
    evidence: packet.evidence,
  });
  if (!inserted.error) return { ok: true };
  const missing = /does not exist|schema cache|PGRST205|42P01/i.test(`${inserted.error.code} ${inserted.error.message}`);
  console.error("[feedback] insert", (inserted.error.message || "").slice(0, 180));
  return { ok: false, status: missing ? 503 : 500 };
}
