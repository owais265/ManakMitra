import "@/lib/postgres-url";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { MemoryTurn } from "@/lib/guest-threads";

export type ThreadMeta = {
  id: string;
  title: string;
  updatedAt: string;
};

export type StoredThread = ThreadMeta & {
  messages: MemoryTurn[];
};

function cleanId(value: string): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error("bad id");
  return id;
}

function cleanTurns(value: unknown): MemoryTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: MemoryTurn[] = [];
  for (const item of value.slice(-40)) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; role?: unknown; text?: unknown; timestamp?: unknown };
    if (row.role !== "user" && row.role !== "ai") continue;
    const text = String(row.text ?? "").replace(/\u0000/g, "").trim().slice(0, 4000);
    if (!text) continue;
    const id = String(row.id ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
    turns.push({
      id: id || "turn",
      role: row.role,
      text,
      timestamp: String(row.timestamp ?? "").slice(0, 40),
    });
  }
  return turns;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ThreadMeta[]> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from mm_threads where user_id = ${context.userId} and expires_at <= now()`;
    const rows = await sql<{ id: string; title: string; updated_at: string }>`
      select id, title, updated_at::text as updated_at
      from mm_threads
      where user_id = ${context.userId} and expires_at > now()
      order by updated_at desc
      limit 40
    `;
    return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
  });

export const readThread = createServerFn({ method: "POST" })
  .validator((id: string) => cleanId(String(id ?? "")))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<StoredThread | null> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ id: string; title: string; body: string; updated_at: string }>`
      select id, title, body, updated_at::text as updated_at
      from mm_threads
      where user_id = ${context.userId} and id = ${data} and expires_at > now()
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    let messages: MemoryTurn[] = [];
    try {
      messages = cleanTurns(JSON.parse(row.body));
    } catch {
      messages = [];
    }
    return { id: row.id, title: row.title, updatedAt: row.updated_at, messages };
  });

export const saveThread = createServerFn({ method: "POST" })
  .validator((input: { id: string; title: string; messages: MemoryTurn[] }) => {
    const id = cleanId(String(input?.id ?? ""));
    const title = String(input?.title ?? "Chat").replace(/\s+/g, " ").trim().slice(0, 80) || "Chat";
    return { id, title, messages: cleanTurns(input?.messages) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    if (!data.messages.length) return { ok: false };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into mm_threads (user_id, id, title, body, updated_at, expires_at)
      values (
        ${context.userId},
        ${data.id},
        ${data.title},
        ${JSON.stringify(data.messages)},
        now(),
        now() + interval '24 hours'
      )
      on conflict (user_id, id) do update
        set title = excluded.title,
            body = excluded.body,
            updated_at = now(),
            expires_at = now() + interval '24 hours'
    `;
    return { ok: true };
  });
