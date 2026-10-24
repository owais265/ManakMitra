import assert from "node:assert/strict";
import test from "node:test";
import { resetLimits, takeLimit, clientIp } from "./rate-limit.ts";
import { retryDecision, retryJitterMs } from "./http-retry.ts";
import { cacheGet, cacheSet, resetRetrievalCache } from "./retrieval-cache.ts";
import type { Retrieval } from "./retrieve.ts";

const row: Retrieval = {
  query: "is 14543",
  hits: [],
  mode: "standards",
  confidence: "high",
  hasEvidence: true,
  grounding: "verified",
};

test("sliding window allows 20 then 429", () => {
  resetLimits();
  const now = 1_000_000;
  for (let i = 0; i < 20; i += 1) {
    const gate = takeLimit("chat:test", now + i);
    assert.equal(gate.ok, true);
  }
  const blocked = takeLimit("chat:test", now + 21);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.ok(blocked.retryAfter >= 1);
  const later = takeLimit("chat:test", now + 60_001);
  assert.equal(later.ok, true);
});

test("retry once on 429 and fast abort, never on 400", () => {
  assert.equal(retryDecision(429, 100), "retry");
  assert.equal(retryDecision(503, 100), "retry");
  assert.equal(retryDecision(null, 100), "retry");
  assert.equal(retryDecision(400, 100), "stop");
  assert.equal(retryDecision(429, 9_000), "stop");
  assert.ok(retryJitterMs(() => 0) === 200);
  assert.ok(retryJitterMs(() => 0.999) <= 600);
});

test("retrieval cache expires and busts by key", () => {
  resetRetrievalCache();
  cacheSet("chat:is 14543", row, 1_000);
  assert.equal(cacheGet("chat:is 14543", 1_000)?.query, "is 14543");
  assert.equal(cacheGet("chat:other", 1_000), null);
  assert.equal(cacheGet("chat:is 14543", 1_000 + 60_001), null);
});

test("retrieval cache drops the oldest row past 200", () => {
  resetRetrievalCache();
  for (let i = 0; i < 205; i += 1) cacheSet(`chat:q${i}`, { ...row, query: `q${i}` }, 1_000 + i);
  assert.equal(cacheGet("chat:q0", 2_000), null);
  assert.equal(cacheGet("chat:q204", 2_000)?.query, "q204");
});

test("platform ip wins over a spoofed forwarded header", () => {
  const request = new Request("https://example.test", {
    headers: { "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.4" },
  });
  assert.equal(clientIp(request), "203.0.113.9");
});
