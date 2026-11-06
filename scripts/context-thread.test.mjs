import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { interopDefault: true });
const { followRetrieval, isContinuation, topicAnchor, boundHistory } = jiti(join(root, "src/lib/query-context.ts"));

const FOLLOWS = [
  "give me exact deatiles",
  "poora batao",
  "what documents do i need",
  "and the inspection",
  "fees?",
  "uska scheme kya hai?",
  "lab?",
  "continue",
  "step by step process",
  "exact roadmap",
];

const SHIFTS = [
  "helmet ISI mark for a biker",
  "who won the ipl",
  "biryani recipe",
  "cement fees?",
  "IS 302 for an electric iron",
  "hallmark on a gold chain",
  "what is the weather in raipur",
  "laptop CRS registration",
  "share price of reliance",
  "prescribe medicine for fever",
];

const ANCHORS = [];
const products = [
  "pet bootels",
  "ceiling fan",
  "cement",
  "pressure cooker",
  "electric iron",
  "pvc pipe",
  "helmet",
  "laptop",
  "water purifier",
  "plywood",
];
const asks = [
  "certification road map",
  "ISI licence process",
  "BIS scheme for manufacturing",
  "product certification application",
  "standard mark process",
];
for (let i = 0; i < 100; i += 1) {
  const token = `topic${i}x`;
  const product = products[i % products.length];
  const ask = asks[i % asks.length];
  ANCHORS.push({
    token,
    text: `i am manufacturing ${token} ${product}. tell me its ${ask}. The old number IS 374 must not leak.`,
  });
}

let carryFail = 0;
for (const anchor of ANCHORS) {
  const history = [{ role: "user", text: anchor.text }];
  for (let step = 0; step < FOLLOWS.length; step += 1) {
    const q = FOLLOWS[step];
    const got = followRetrieval(q, history);
    const ok =
      isContinuation(q) &&
      got.toLowerCase().includes(anchor.token) &&
      !/\b374\b/.test(got) &&
      got.toLowerCase().includes(q.split(" ")[0].toLowerCase().replace("?", ""));
    if (!ok) {
      carryFail += 1;
      if (carryFail < 8) console.error("CARRY", anchor.token, q, "=>", got);
    }
    history.push({ role: "user", text: q });
    const anchorNow = topicAnchor(history);
    if (!anchorNow.toLowerCase().includes(anchor.token)) {
      carryFail += 1;
      if (carryFail < 8) console.error("ANCHOR LOST", anchor.token, step, anchorNow);
    }
  }
}

let safeFail = 0;
for (let i = 0; i < 100; i += 1) {
  const token = `safe${i}z`;
  const anchor = ANCHORS[i];
  const history = [{ role: "user", text: `${anchor.text} unique ${token}` }];
  for (const q of SHIFTS) {
    const got = followRetrieval(q, history);
    if (got.toLowerCase().includes(token) || got.toLowerCase().includes(anchor.token)) {
      safeFail += 1;
      if (safeFail < 8) console.error("LEAK", q, "=>", got.slice(0, 180));
    }
  }
}

const pet = followRetrieval("give me exact deatiles", [
  { role: "user", text: "i am manufacturing pet bootels tell me its certification road map" },
]);
assert.match(pet, /pet bootels/i);
assert.match(pet, /deatiles/i);
assert.equal(isContinuation("give me exact deatiles"), true);
assert.equal(isContinuation("helmet ISI mark for a biker"), false);

const scheme = followRetrieval("uska scheme kya hai?", [{ role: "user", text: "ceiling fan standard IS 374" }]);
assert.match(scheme, /fan/i);
assert.doesNotMatch(scheme, /374/);
const fan = followRetrieval("ceiling fan BIS standard", [{ role: "user", text: "What is IS 14543?" }]);
assert.equal(fan, "ceiling fan BIS standard");
const lab = followRetrieval("lab?", [{ role: "user", text: "cement plant 492001" }]);
assert.match(lab, /492001/);
assert.match(lab, /cement/i);

const longHist = [{ role: "user", text: "i am manufacturing quartzcrucible widgets. tell me its bis certification road map" }];
for (const q of FOLLOWS) longHist.push({ role: "user", text: q });
const bounded = boundHistory(longHist);
const tenth = followRetrieval("exact roadmap", bounded);
assert.match(tenth, /quartzcrucible/);
assert.doesNotMatch(tenth, /\b374\b/);
if (carryFail || safeFail) process.exit(1);
console.log("context thread tests passed");
