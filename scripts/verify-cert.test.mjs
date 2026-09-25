import assert from "node:assert/strict";
import { checkBrand, checkLicence, normalizeLicence, verdictFromPhotoRead } from "../src/lib/verify-cert.ts";

let passed = 0;
function check(fn) {
  fn();
  passed += 1;
}

const products = ["cement", "helmet", "laptop", "ceiling fan", "gold jewellery", "toy", "pressure cooker", "led bulb", "mineral water", "mixer grinder"];

for (let i = 0; i < 2500; i += 1) {
  const digits = String(100000 + (i % 900000)).padStart(7, "0");
  const raws = [
    `CM/L-${digits}`,
    `cm / l - ${digits}`,
    `CML${digits}`,
    `cml-${digits}`,
  ];
  check(() => {
    const raw = raws[i % raws.length];
    const verdict = checkLicence(raw);
    assert.equal(verdict.status, "format-ok");
    assert.equal(verdict.scheme, "ISI · Scheme-I");
    assert.equal(verdict.marks[0], `CM/L-${digits}`);
    assert.equal(/valid licence|granted|expired/i.test(verdict.detail), false);
  });
}

for (let i = 0; i < 2000; i += 1) {
  check(() => {
    const digits = String(100000 + i).padStart(6, "0");
    const verdict = checkLicence(i % 2 === 0 ? `R-${digits}` : `r ${digits}`);
    assert.equal(verdict.status, "format-ok");
    assert.equal(verdict.scheme, "CRS · Scheme-II");
    assert.match(verdict.marks[0], /^R-\d{6,12}$/);
  });
}

for (let i = 0; i < 1500; i += 1) {
  check(() => {
    const huid = `A${String(10000 + (i % 89999)).slice(0, 5)}`;
    const verdict = checkLicence(` ${huid.toLowerCase()} `);
    assert.equal(verdict.status, "format-ok");
    assert.equal(verdict.scheme, "Hallmark · HUID");
  });
}

const bad = ["", "123", "CM/L-12", "CM/L-123456789", "R-12", "HELLO", "123456", "<script>", "CM/L-abcdef", "licence", "null", "undefined"];
for (let i = 0; i < 2000; i += 1) {
  check(() => {
    const verdict = checkLicence(`${bad[i % bad.length]}${i % 7 === 0 ? "  " : ""}`);
    assert.notEqual(verdict.status, "format-ok");
    assert.equal(/granted|is valid/i.test(verdict.title + verdict.detail), false);
  });
}

for (let i = 0; i < 1500; i += 1) {
  const name = products[i % products.length];
  check(() => {
    const verdict = checkBrand(i % 3 === 0 ? name.toUpperCase() : ` ${name} `);
    assert.ok(verdict.status === "brand-hit" || verdict.status === "unclear");
    assert.equal(/holds a licence|is licensed|granted/i.test(verdict.title), false);
    if (verdict.status === "brand-hit") assert.ok(verdict.marks.length > 0);
  });
}

for (let i = 0; i < 500; i += 1) {
  check(() => {
    const verdict = checkBrand(`IS ${269 + (i % 50)} cement batch ${i}`);
    assert.equal(verdict.status, "brand-hit");
    assert.ok(verdict.marks.some((mark) => mark.startsWith("IS ")));
  });
}

for (let i = 0; i < 400; i += 1) {
  check(() => {
    const verdict = checkBrand(`zz-unknown-brand-${i}`);
    assert.equal(verdict.status, "not-found");
    assert.equal(verdict.marks.length, 0);
  });
}

for (let i = 0; i < 300; i += 1) {
  check(() => {
    const read = verdictFromPhotoRead({ licence: `CM/L-${1000000 + i}`, isNumber: null, brand: null });
    assert.equal(read.status, "format-ok");
    assert.match(read.title, /photo/i);
  });
  check(() => {
    const miss = verdictFromPhotoRead({ licence: "nope", isNumber: null, brand: `not-a-product-${i}` });
    assert.equal(miss.status, "unreadable");
  });
}

check(() => {
  assert.equal(normalizeLicence("सीएम").length > 0, true);
  const hindi = checkLicence("CM/L-१२३४५६७");
  assert.equal(hindi.status, "format-ok");
  assert.equal(hindi.marks[0], "CM/L-1234567");
});

console.log(`verify checks passed: ${passed}`);
if (passed < 10000) {
  console.error(`expected at least 10000, got ${passed}`);
  process.exit(1);
}
