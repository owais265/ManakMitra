import assert from "node:assert/strict";
import test from "node:test";
import { guardSpoken } from "./answer-guard.ts";

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
