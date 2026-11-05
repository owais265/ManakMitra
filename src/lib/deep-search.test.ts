import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossVerify } from "./deep-search.ts";
import type { Retrieval } from "./rag-types.ts";

function hit(title: string, score: number) {
  return { kind: "standard" as const, title, body: title, url: "https://www.bis.gov.in", score };
}

function pack(hits: ReturnType<typeof hit>[]): Retrieval {
  return { query: "q", hits, mode: "standards", confidence: "medium", hasEvidence: hits.length > 0, grounding: hits.length ? "verified" : "refuse" };
}

describe("crossVerify", () => {
  it("locks a strong local row and drops a conflicting hybrid standard", () => {
    const report = crossVerify(
      pack([hit("IS 269 : 2015 cement", 0.8)]),
      pack([hit("IS 14543 water", 0.4), hit("IS 269 : 2015 cement", 0.3)]),
    );
    assert.equal(report.verdict, "local-lock");
    assert.equal(report.merged.hits[0]?.title.includes("269"), true);
    assert.equal(report.merged.hits.some((row) => row.title.includes("14543")), false);
  });

  it("does not pick a side when the two searches name different standards", () => {
    const report = crossVerify(pack([hit("IS 4151 helmet", 0.2)]), pack([hit("IS 2925 helmet", 0.2)]));
    assert.equal(report.verdict, "split");
    assert.match(report.note, /Do not pick one/);
    assert.equal(report.merged.hits.some((row) => row.title.includes("2925")), false);
  });
});
