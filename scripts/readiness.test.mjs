import assert from "node:assert/strict";
import { readinessSheet, statedFacts } from "../src/lib/readiness.ts";
import { listProductFamilies } from "../src/lib/product-playbook.ts";

let passed = 0;
function check(fn) {
  fn();
  passed += 1;
}

const led = readinessSheet("20W self-ballasted LED bulb, 220-240V, 50Hz, B22");
check(() => {
  assert.ok(led.verdict.marks.includes("IS 16102"));
  assert.ok(led.related.includes("IS 16107"));
  assert.equal(led.verdict.scheme, "CRS · Scheme-II");
  assert.deepEqual(statedFacts(led.query).map((fact) => fact.label), ["Power", "Voltage", "Frequency", "Cap"]);
  const blob = JSON.stringify(led);
  assert.equal(/57%|compliant|clause 5\.1|4 MΩ|thousands of requirements/i.test(blob), false);
});

check(() => {
  const cement = readinessSheet("OPC cement");
  assert.ok(cement.verdict.marks.includes("IS 269"));
  assert.equal(cement.verdict.marks.includes("IS 16102"), false);
  assert.notEqual(cement.verdict.title, led.verdict.title);
});

const titles = new Set();
for (const family of listProductFamilies()) {
  const alias = family.aliases[0];
  check(() => {
    const sheet = readinessSheet(alias, family.scheme === "isi" ? "CM/L-1234567" : "");
    assert.equal(/compliant|57%/i.test(JSON.stringify(sheet)), false);
    assert.ok(sheet.open.some((line) => /percentage|licence|detail|standard/i.test(line)));
    if (family.is.length && sheet.verdict.status === "brand-hit") {
      assert.ok(sheet.verdict.marks.some((mark) => family.is.includes(mark.replace("IS ", ""))));
    }
    titles.add(sheet.verdict.title);
  });
}

check(() => {
  const withNumber = readinessSheet("ceiling fan", "CM/L-7654321");
  assert.equal(withNumber.licence?.confidence, "high");
  assert.ok(withNumber.open.some((line) => line.includes("CM/L-7654321")));
  const bad = readinessSheet("ceiling fan", "FAN123");
  assert.notEqual(bad.licence?.confidence, "high");
  assert.ok(titles.size >= 20);
});

console.log(`readiness checks ${passed} titles ${titles.size}`);
if (passed < 50) process.exit(1);
