import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const { featureRerank, rerankCandidates } = jiti(join(root, "src/lib/rerank.server.ts"));
const { hybridExtrasAllowed, runHybridRetrieve } = jiti(join(root, "src/lib/hybrid.ts"));
const { vectorRetrieve } = jiti(join(root, "src/lib/rag.ts"));

const official = "https://www.bis.gov.in/product-certification/";
const water = {
  kind: "standard",
  title: "IS 14543:2024 Packaged Drinking Water",
  body: "IS 14543 packaged drinking water",
  url: official,
  score: 0.2,
  lane: "bm25",
};
const generic = {
  kind: "standard",
  title: "ISI Mark product certification scheme",
  body: "scheme-i manak online",
  url: official,
  score: 0.3,
  lane: "trgm",
};
const foreign = {
  kind: "link",
  title: "IS 14543 mirror",
  body: "IS 14543",
  url: "https://example.com/is-14543",
  score: 0.99,
  lane: "bm25",
};

function weakHit(score, title = "generic catalogue row") {
  return {
    query: "plastic bottle",
    hits: [{ kind: "standard", title, body: "note", url: official, score }],
    mode: "standards",
    confidence: score >= 0.45 ? "high" : "low",
    hasEvidence: true,
    grounding: "verified",
  };
}

test("feature-rerank drops a non-official URL and keeps the exact IS above a generic row", () => {
  const ranked = featureRerank("IS 14543 packaged water", [generic, foreign, water], null);
  assert.equal(ranked.some((hit) => /example\.com/.test(hit.url)), false);
  assert.match(ranked[0].title, /14543/);
});

test("rerankCandidates without a key stays feature-rerank and never returns a foreign host", async () => {
  const prevR = process.env.RERANK_API_KEY;
  const prevC = process.env.COHERE_API_KEY;
  delete process.env.RERANK_API_KEY;
  delete process.env.COHERE_API_KEY;
  const ranked = await rerankCandidates("IS 14543", [foreign, generic, water], null);
  assert.ok(ranked.length);
  assert.equal(ranked.some((hit) => /example\.com/.test(hit.url)), false);
  assert.match(ranked[0].title, /14543/);
  if (prevR === undefined) delete process.env.RERANK_API_KEY;
  else process.env.RERANK_API_KEY = prevR;
  if (prevC === undefined) delete process.env.COHERE_API_KEY;
  else process.env.COHERE_API_KEY = prevC;
});

test("HYBRID_RAG=0 does not open the extra lane", () => {
  const prev = process.env.HYBRID_RAG;
  process.env.HYBRID_RAG = "0";
  assert.equal(hybridExtrasAllowed("plastic bottle standard", weakHit(0.1)), false);
  if (prev === undefined) delete process.env.HYBRID_RAG;
  else process.env.HYBRID_RAG = prev;
});

test("policy pin, strong lock, and a typed IS already on top skip extras", () => {
  const prev = process.env.HYBRID_RAG;
  process.env.HYBRID_RAG = "1";
  const pin = weakHit(0.99, "Hallmark / HUID applies only to jewellery");
  pin.confidence = "high";
  assert.equal(hybridExtrasAllowed("HUID on a helmet", pin), false);
  assert.equal(hybridExtrasAllowed("cement standard", weakHit(0.92, "IS 269")), false);
  const typed = weakHit(0.4, "IS 14543:2024 Packaged Drinking Water");
  assert.equal(hybridExtrasAllowed("IS 14543", typed), false);
  if (prev === undefined) delete process.env.HYBRID_RAG;
  else process.env.HYBRID_RAG = prev;
});

test("exact IS 14543 and a frozen paraphrase are not replaced", async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    return orig(url, init);
  };
  try {
    const exactLocal = vectorRetrieve("IS 14543");
    const exactHybrid = await runHybridRetrieve("IS 14543");
    assert.match(exactLocal.hits[0]?.title || "", /14543/);
    assert.equal(exactHybrid.hits[0]?.title, exactLocal.hits[0]?.title);

    const paraLocal = vectorRetrieve("paani ki plastic bottle ka standard");
    assert.ok((paraLocal.hits[0]?.score ?? 0) >= 0.45);
    const paraHybrid = await runHybridRetrieve("paani ki plastic bottle ka standard");
    assert.equal(paraHybrid.hits[0]?.title, paraLocal.hits[0]?.title);
    assert.match(paraHybrid.hits[0]?.title || "", /12252|15609|14543/);
  } finally {
    globalThis.fetch = orig;
  }
  assert.equal(
    calls.some((url) => /supabase\.co|generativelanguage|cohere\.com/i.test(url)),
    false,
  );
});
