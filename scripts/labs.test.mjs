import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { areaMapUrl, BIS_LABS, haversineKm, pinCentroid, rankLabs } from "../src/lib/labs.ts";

let passed = 0;
function check(fn) {
  fn();
  passed += 1;
}

const sahibabad = BIS_LABS.find((lab) => lab.id === "CL");
const chennai = BIS_LABS.find((lab) => lab.id === "SRL");
assert.ok(sahibabad && chennai);

const playbook = readFileSync(new URL("../src/lib/product-playbook.ts", import.meta.url), "utf8");
const products = [...playbook.matchAll(/aliases:\s*\[(?:\s*"([^"]+)")/g)].map((match) => match[1]);
assert.ok(products.length >= 20);

const cities = [
  ["Delhi", 28.61, 77.21], ["Mumbai", 19.08, 72.88], ["Chennai", 13.08, 80.27], ["Kolkata", 22.57, 88.36],
  ["Bengaluru", 12.97, 77.59], ["Hyderabad", 17.39, 78.49], ["Ahmedabad", 23.02, 72.57], ["Jaipur", 26.91, 75.79],
  ["Lucknow", 26.85, 80.95], ["Patna", 25.59, 85.14], ["Bhopal", 23.26, 77.41], ["Raipur", 21.25, 81.63],
  ["Kochi", 9.93, 76.27], ["Guwahati", 26.14, 91.74], ["Chandigarh", 30.73, 76.78], ["Pune", 18.52, 73.86],
];
const remote = [
  ["Leh", 34.16, 77.58], ["Port Blair", 11.62, 92.73], ["Kargil", 34.55, 76.13], ["Aizawl", 23.73, 92.72],
  ["Gangtok", 27.33, 88.61], ["Itanagar", 27.08, 93.61], ["Agartala", 23.83, 91.28], ["Kohima", 25.67, 94.11],
  ["Imphal", 24.82, 93.94], ["Shillong", 25.58, 91.89], ["Kavaratti", 10.56, 72.64], ["Diu", 20.71, 70.98],
];
const rural = [
  ["Bastar", 19.07, 81.96], ["Dantewada", 18.89, 81.35], ["Barmer", 25.75, 71.39], ["Jaisalmer", 26.92, 70.91],
  ["Kalahandi", 19.91, 83.16], ["Koraput", 18.81, 82.71], ["Mandla", 22.6, 80.37], ["Dindori", 22.95, 81.08],
  ["Kinnaur", 31.65, 78.48], ["Lahaul", 32.57, 77.03], ["Nicobar", 7.0, 93.8], ["Sundarban", 22.0, 88.9],
];

function stretch(seed, count, bucket) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const base = bucket[i % bucket.length];
    rows.push([`${bucket === cities ? "city" : bucket === remote ? "remote" : "rural"}-${i}`, base[1] + ((i % 7) - 3) * 0.08, base[2] + ((i % 5) - 2) * 0.08]);
  }
  return rows;
}

const places = [...stretch(0, 200, cities), ...stretch(0, 200, remote), ...stretch(0, 200, rural)];
const nearestByPlace = new Map();

for (const [name, lat, lng] of places) {
  for (const product of products) {
    check(() => {
      const ranked = rankLabs(lat, lng, product);
      assert.ok(ranked.length > 8);
      for (let n = 1; n < ranked.length; n += 1) assert.ok(ranked[n].km >= ranked[n - 1].km);
      assert.equal(ranked.some((lab) => lab.confidence === "high"), true);
      assert.equal(ranked.some((lab) => lab.confidence === "low"), true);
      const url = areaMapUrl(lat, lng, String(name), product);
      assert.match(url, /maps\.google\.com/);
      assert.ok(url.includes(String(lat)));
    });
  }
  nearestByPlace.set(name, rankLabs(lat, lng)[0].id);
}

check(() => {
  const ids = new Set([...nearestByPlace.values()]);
  assert.ok(ids.size >= 8, `expected different nearest labs, got ${ids.size}`);
});

check(() => {
  const delhi = rankLabs(28.61, 77.21);
  const high = delhi.find((lab) => lab.confidence === "high");
  assert.equal(high?.id, "CL");
  assert.ok(delhi[0].km < 30);
  const raipur = rankLabs(21.25, 81.63);
  assert.ok(raipur[0].km > 80);
  assert.notEqual(delhi[0].id, rankLabs(13.08, 80.27)[0].id);
  assert.notEqual(areaMapUrl(21.25, 81.63, "Raipur", "cement"), areaMapUrl(13.08, 80.27, "Chennai", "helmet"));
});

check(() => {
  assert.equal(haversineKm(sahibabad.lat, sahibabad.lng, sahibabad.lat, sahibabad.lng), 0);
  const ab = haversineKm(28.61, 77.21, sahibabad.lat, sahibabad.lng);
  assert.ok(ab < haversineKm(28.61, 77.21, chennai.lat, chennai.lng));
  assert.equal(pinCentroid("492001")?.label, "Raipur");
  assert.equal(pinCentroid("000000"), null);
});

console.log(`places ${places.length} products ${products.length} checks ${passed}`);
if (places.length !== 600) process.exit(1);
if (passed < places.length * products.length) process.exit(1);
