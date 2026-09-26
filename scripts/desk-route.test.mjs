import assert from "node:assert/strict";
import { deskKind, deskReply, labsFinderResult } from "../src/lib/desk-route.ts";
import { listProductFamilies } from "../src/lib/product-playbook.ts";

const families = listProductFamilies();
const products = families.map((family) => family.aliases[0]);
const pins = ["110001", "400001", "600001", "492001", "781001", "700001", "560001", "500001", "160017", "800001"];
const quiet = [
  "what is BIS",
  "how do I apply for cement ISI",
  "hello",
  "what is a BIS laboratory",
  "verification process for a licence",
  "tell me the title of IS 269",
  "thanks",
];

let passed = 0;
const TOTAL = 98354;

for (let i = 0; i < TOTAL; i += 1) {
  const product = products[i % products.length];
  const pin = pins[i % pins.length];
  const slot = i % 7;
  if (slot === 0) {
    const query = `how do I apply for ${product}`;
    assert.equal(deskKind(query), null, query);
    assert.equal(deskReply(query), null);
  } else if (slot === 1) {
    const query = quiet[i % quiet.length];
    assert.equal(deskKind(query), null, query);
  } else if (slot === 2) {
    const query = `product file for ${product}`;
    assert.equal(deskKind(query), "file");
    const reply = deskReply(query);
    assert.match(reply, /\[SOURCE\]/);
    assert.equal(/57%|compliant|clause 5\.1/i.test(reply), false);
    assert.doesNotMatch(reply, /No laboratory/);
  } else if (slot === 3) {
    const digits = String(1000000 + (i % 8000000)).slice(0, 7);
    const query = `verify CM/L-${digits}`;
    assert.equal(deskKind(query), "verify");
    const reply = deskReply(query);
    assert.match(reply, new RegExp(`CM/L-${digits}`));
    assert.match(reply, /ISI/);
    assert.match(reply, /\[META\] high \|/);
  } else if (slot === 4) {
    const query = `find a laboratory near ${pin} for ${product}`;
    assert.equal(deskKind(query), "labs");
    const reply = deskReply(query);
    assert.match(reply, new RegExp(pin));
    assert.match(reply, /km/);
    assert.match(reply, /\[SOURCE\]/);
    assert.equal(reply.includes("google.com/maps"), false);
    const board = labsFinderResult(query);
    assert.ok(board);
    assert.match(board.mapUrl, /output=embed/);
    assert.ok(board.nearby.length + board.farther.length > 0);
    assert.equal(/57%|compliant|not a pass/i.test(reply), false);
  } else if (slot === 5) {
    const query = `verify ${product}`;
    assert.equal(deskKind(query), "verify");
    const reply = deskReply(query);
    assert.match(reply, /\[FOLLOW_UP\] Verify product/);
    assert.equal(/No catalogue pin/i.test(reply), false);
    assert.equal(reply.includes("CM/L-"), false);
  } else {
    const query = "find a laboratory";
    assert.equal(deskKind(query), "labs");
    const reply = deskReply(query);
    assert.match(reply, /6-digit PIN/);
    assert.equal(reply.includes("km"), false);
  }
  passed += 1;
}

assert.equal(deskKind("How do I verify a gold hallmark HUID?"), null);
assert.equal(deskKind("find the laboratory clause of IS 269"), null);
assert.equal(deskKind("how do I find a laboratory"), null);
assert.equal(deskKind("find a laboratory"), "labs");
assert.match(deskReply("verify cement") || "", /IS 269/);
assert.match(deskReply("verify helmet") || "", /IS 2925|helmet/i);
assert.match(deskReply("product file for cement CM/L-1234567") || "", /CM\/L-1234567/);
assert.match(deskReply("CM/L-1234567", "hi") || "", /CM\/L-1234567/);
assert.match(deskReply("CM/L-1234567", "hi") || "", /MANAK|आकार|ISI/);
assert.match(deskReply("find a laboratory", "ta") || "", /PIN|ஆய்வக/);
assert.equal(deskKind("hello"), null);
console.log(`desk checks ${passed}`);
if (passed !== TOTAL) process.exit(1);
