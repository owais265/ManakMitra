import assert from "node:assert/strict";
import test from "node:test";
import { guardCase, guardSpoken } from "./answer-guard.ts";

const trusted = "IS 14543:2024 Packaged drinking water\nhttps://www.bis.gov.in/x";
const pack = "Catalogue row: IS 14543:2024. https://www.bis.gov.in";

test("keeps an answer that only names a packed IS", () => {
  const spoken = "For packaged water the catalogue row is IS 14543:2024. https://www.bis.gov.in";
  assert.equal(guardSpoken(spoken, trusted, pack), spoken);
});

test("replaces an invented IS with the pack fallback", () => {
  const spoken = "The standard is IS 99999 for this product.";
  assert.equal(guardSpoken(spoken, trusted, pack), pack);
});

test("allows an official portal that is not on the hit row", () => {
  const spoken = "Apply on https://www.manakonline.in after you confirm IS 14543.";
  assert.equal(guardSpoken(spoken, trusted, pack), spoken);
});

test("replaces a non-official URL that is not in the pack", () => {
  const spoken = "See https://random-blog.example/is for IS 14543.";
  assert.equal(guardSpoken(spoken, trusted, pack), pack);
});

test("empty model text falls back", () => {
  assert.equal(guardSpoken("  ", trusted, pack), pack);
});

test("a numbered case keeps the other parts when one IS is not in the pack", () => {
  const spoken = "1. Rapid hardening cement is IS 8041.\n2. The test method IS 4031 is not listed here.\n3. Confirm the fee on https://www.manakonline.in";
  const trustedCase = "IS 8041 : 1990 Rapid hardening\nhttps://www.bis.gov.in/x";
  const kept = guardCase(spoken, trustedCase, pack);
  assert.match(kept, /IS 8041/);
  assert.match(kept, /not in this pack/);
  assert.doesNotMatch(kept, /4031/);
  assert.match(kept, /manakonline\.in/);
  assert.notEqual(kept, pack);
});
