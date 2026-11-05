import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { foldSpokenQuery } from "./spoken-is.ts";

describe("foldSpokenQuery", () => {
  it("collapses spoken IS and Indic digits", () => {
    assert.equal(foldSpokenQuery("What is I S 4151"), "What is IS 4151");
    assert.equal(foldSpokenQuery("मुझे आई एस १४५४३ बताइए"), "मुझे IS 14543 बताइए");
    assert.equal(foldSpokenQuery("ஐ எஸ் 4151"), "IS 4151");
    assert.equal(foldSpokenQuery("ceiling fan"), "ceiling fan");
    assert.equal(foldSpokenQuery("standrd for cemenet portlant"), "standard for cement portland");
    assert.equal(foldSpokenQuery("helmate hardning"), "helmet hardening");
    assert.match(foldSpokenQuery("helmt two wheeler standrd"), /two wheeler helmet/);
  });
});
