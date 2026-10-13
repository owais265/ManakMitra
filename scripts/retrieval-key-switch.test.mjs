import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";

const coolPath = "/workspace/.grok/query-embed-cool.json";

test("hybrid query embed sticks, then switches on 429 without calling a cooled key", async () => {
  writeFileSync(coolPath, JSON.stringify({ cursor: 0, cool: {} }));
  const calls = [];
  globalThis.fetch = async (url) => {
    const key = new URL(url).searchParams.get("key") || "";
    calls.push(key.slice(-6));
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: { details: [{ retryDelay: "40s" }] } }), { status: 429 });
    }
    return new Response(JSON.stringify({ embedding: { values: Array(768).fill(0.01) } }), { status: 200 });
  };
  const mod = await import("/workspace/src/lib/supabase.server.ts");
  const first = await mod.embedGemini768("packaged drinking water");
  assert.equal(first?.length, 768);
  assert.equal(calls.length, 2);
  const second = await mod.embedGemini768("electric iron");
  assert.equal(second?.length, 768);
  assert.equal(calls.length, 3);
  assert.equal(calls[2], calls[1]);
  unlinkSync(coolPath);
});
