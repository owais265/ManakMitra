type TaggedSql = <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T[]>;

export const GUEST_QUERY_CAP = 20;
export const GUEST_COOKIE = "mm_guest";

export function readGuestId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key !== GUEST_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    if (/^[A-Za-z0-9_-]{16,80}$/.test(value)) return value;
  }
  return null;
}

export function newGuestId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Session cookie. Secure is allowed on localhost and on https. */
export function guestSetCookie(id: string): string {
  return `${GUEST_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Secure`;
}

/** Count one question for this guest. Returns "limit" without incrementing past the cap. */
export async function chargeGuestId(sql: TaggedSql, guestId: string): Promise<"ok" | "limit"> {
  const rows = await sql<{ used: number }>`
    insert into mm_guest_quota (guest_id, used, updated_at)
    values (${guestId}, 1, now())
    on conflict (guest_id) do update
      set used = mm_guest_quota.used + 1,
          updated_at = now()
    where mm_guest_quota.used < ${GUEST_QUERY_CAP}
    returning used
  `;
  return rows.length ? "ok" : "limit";
}

export async function guestIsLocked(request: Request): Promise<boolean> {
  const guestId = readGuestId(request.headers.get("cookie"));
  if (!guestId) return false;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ used: number }>`
    select used from mm_guest_quota where guest_id = ${guestId}
  `;
  return Number(rows[0]?.used ?? 0) >= GUEST_QUERY_CAP;
}

export async function chargeGuest(request: Request): Promise<{ ok: boolean; setCookie?: string }> {
  const existing = readGuestId(request.headers.get("cookie"));
  const guestId = existing ?? newGuestId();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const result = await chargeGuestId(sql, guestId);
  return {
    ok: result === "ok",
    setCookie: existing ? undefined : guestSetCookie(guestId),
  };
}
