import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { GUEST_QUERY_CAP, chargeGuestId, readGuestId } from "./guest-quota.ts";

test("guest cookie id is scoped to one cookie", () => {
  assert.equal(readGuestId(null), null);
  assert.equal(readGuestId("a=b; mm_guest=abc"), null);
  assert.equal(readGuestId("mm_guest=abc123abc123abcd"), "abc123abc123abcd");
  assert.equal(readGuestId("other=1; mm_guest=zzzzzzzzzzzzzzzz"), "zzzzzzzzzzzzzzzz");
});

test("the 21st charge locks only that guest", async () => {
  const db = new PGlite();
  await db.exec(`
    create table mm_guest_quota (
      guest_id text primary key,
      used integer not null default 0,
      updated_at timestamptz not null default now()
    );
  `);
  const sql = async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await db.query(text, values);
    return result.rows as T[];
  };
  // The tagged-template type is the app Sql. This runner matches that call shape.
  const tagged = sql as Parameters<typeof chargeGuestId>[0];
  for (let i = 0; i < GUEST_QUERY_CAP; i += 1) {
    assert.equal(await chargeGuestId(tagged, "guest-a-guest-a"), "ok");
  }
  assert.equal(await chargeGuestId(tagged, "guest-a-guest-a"), "limit");
  assert.equal(await chargeGuestId(tagged, "guest-b-guest-b"), "ok");
  const rows = await db.query<{ guest_id: string; used: number }>("select guest_id, used from mm_guest_quota order by guest_id");
  assert.deepEqual(rows.rows, [
    { guest_id: "guest-a-guest-a", used: 20 },
    { guest_id: "guest-b-guest-b", used: 1 },
  ]);
});
