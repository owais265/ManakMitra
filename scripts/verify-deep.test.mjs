import assert from "node:assert/strict";
import { checkBrand, checkLicence, verdictFromPhotoRead } from "../src/lib/verify-cert.ts";
import { listProductFamilies } from "../src/lib/product-playbook.ts";

let passed = 0;
function check(fn) {
  fn();
  passed += 1;
}

const families = listProductFamilies();
const titles = new Set();
const rawScheme = /^(isi|crs|hallmark)$/;

for (const family of families) {
  for (const alias of family.aliases) {
    check(() => {
      const verdict = checkBrand(alias);
      assert.equal(rawScheme.test(verdict.scheme || ""), false);
      assert.notEqual(verdict.status, "not-found");
      assert.equal(/granted|is valid/i.test(verdict.title), false);
      if (verdict.confidence === "high") assert.fail(`${alias} catalogue hit must not be high`);
      if (family.is.length && verdict.status === "brand-hit") {
        assert.ok(verdict.marks.some((mark) => family.is.includes(mark.replace("IS ", ""))));
      }
      titles.add(verdict.title);
    });
  }
  for (const is of family.is) {
    check(() => {
      const verdict = checkBrand(`IS ${is}`);
      assert.equal(verdict.status, "brand-hit");
      assert.ok(verdict.marks.includes(`IS ${is}`));
      if (family.scheme) {
        assert.ok(verdict.scheme);
        assert.equal(rawScheme.test(verdict.scheme || ""), false);
      }
    });
  }
}

const distinct = ["cement", "helmet", "laptop", "gold jewellery", "pressure cooker", "tyre", "led lamp"];
check(() => {
  const seen = new Set(distinct.map((name) => checkBrand(name).title));
  assert.ok(seen.size >= 6, `titles collapsed: ${[...seen].join(" | ")}`);
});

check(() => {
  assert.equal(checkBrand("सीमेंट").marks[0], checkBrand("cement").marks[0]);
  assert.notEqual(checkBrand("cement").title, checkBrand("gold jewellery").title);
  assert.equal(checkBrand("IS 269").scheme, "ISI · Scheme-I");
  assert.equal(checkBrand("unknown brand zzz").confidence, "none");
});

for (let i = 0; i < 400; i += 1) {
  const digits = String(1000000 + i).slice(0, 7);
  check(() => {
    const verdict = checkLicence(`cml ${digits}`);
    assert.equal(verdict.confidence, "high");
    assert.equal(verdict.scheme, "ISI · Scheme-I");
    assert.equal(verdict.marks[0], `CM/L-${digits}`);
  });
  check(() => {
    const verdict = checkLicence(`R-${41000000 + i}`);
    assert.equal(verdict.scheme, "CRS · Scheme-II");
    assert.equal(verdict.confidence, "high");
  });
}

check(() => {
  assert.equal(checkLicence("FAN123").scheme, null);
  assert.equal(checkLicence("HUID12").confidence, "none");
  assert.equal(checkLicence("A12345").confidence, "low");
  assert.equal(checkLicence("A12345").scheme, "Hallmark · HUID");
  const photo = verdictFromPhotoRead({ licence: "FAN123", brand: "cement", isNumber: null });
  assert.equal(photo.status, "brand-hit");
  assert.match(photo.title, /cement|IS 269/i);
  const blank = verdictFromPhotoRead({ licence: null, brand: null, isNumber: null });
  assert.equal(blank.confidence, "none");
});

console.log(`verify deep checks ${passed} families ${families.length} distinct titles ${titles.size}`);
if (titles.size < 20) {
  console.error("results still look the same");
  process.exit(1);
}
