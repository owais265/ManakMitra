import assert from "node:assert/strict";
import { deskKind, deskReply, needsDeviceLocation } from "../src/lib/desk-route.ts";

const products = [
  "cement", "LED bulb", "helmet", "pressure cooker", "ceiling fan", "toy",
  "laptop", "charger", "steel utensil", "PVC pipe", "water heater",
  "circuit breaker", "electric iron", "mixer grinder", "packaged drinking water",
  "safety glass", "plywood", "biscuit", "soap", "bearing", "gasket",
  "detergent", "shampoo", "washing machine", "water purifier", "ceramic tile",
];
const pins = ["110001", "400001", "600001", "492001", "781001", "700001", "560001", "500001", "160017", "800001"];
const cities = ["Delhi", "Mumbai", "Chennai", "Raipur", "Kolkata", "Bengaluru", "Hyderabad", "Pune", "Jaipur", "Patna"];

const labs = [];
const files = [];
const verifies = [];
const normal = [];

for (let i = 0; i < 100; i += 1) {
  const p = products[i % products.length];
  const pin = pins[i % pins.length];
  const city = cities[i % cities.length];
  const slot = i % 5;
  if (slot === 0) labs.push({ q: `find labs near ${pin} for ${p}`, kind: "labs", loc: false, must: [pin, "km"] });
  else if (slot === 1) labs.push({ q: `find labs near this for ${p}`, kind: "labs", loc: true, must: ["PIN"], ban: ["km"] });
  else if (slot === 2) labs.push({ q: `nearest laboratory around me for ${p}`, kind: "labs", loc: true, must: ["PIN"], ban: ["km"] });
  else if (slot === 3) labs.push({ q: `labs in ${city} for ${p}`, kind: "labs", loc: false, must: ["km"] });
  else labs.push({ q: i % 2 === 0 ? `what is a BIS laboratory for ${p}` : `find the laboratory clause of IS ${1000 + i}`, kind: null, loc: false, ban: ["km", "6-digit PIN"] });
}

for (let i = 0; i < 100; i += 1) {
  const p = products[i % products.length];
  const pin = pins[i % pins.length];
  files.push({
    q: i % 4 === 0 ? `product file for ${p} near ${pin}` : `product file for ${p} before I apply`,
    kind: "file",
    loc: false,
    ban: ["No listed laboratory", "6-digit PIN"],
  });
}

for (let i = 0; i < 100; i += 1) {
  const p = products[i % products.length];
  const digits = String(1000000 + (i % 8000000)).slice(0, 7);
  verifies.push(
    i % 2 === 0
      ? { q: `verify CM/L-${digits}`, kind: "verify", loc: false, must: [`CM/L-${digits}`], ban: ["6-digit PIN", "km"] }
      : { q: `verify ${p}`, kind: "verify", loc: false, ban: ["6-digit PIN", "No listed laboratory"] },
  );
}

const chatter = [
  "hello", "thanks", "who are you", "how are you", "good morning",
  "what is BIS", "title of IS 269", "how do I apply for cement ISI",
  "namaste", "bye", "what can you do", "help me",
  "cricket score", "biryani recipe", "ok", "tell me about yourself",
  "how do I find a laboratory", "verification process for a licence",
  "How do I verify a gold hallmark HUID?", "fan pe HUID kaise check karun",
];
for (let i = 0; i < 100; i += 1) {
  const line = chatter[i % chatter.length];
  normal.push({
    q: line,
    kind: line === "fan pe HUID kaise check karun" ? "verify" : null,
    loc: false,
    ban: line === "fan pe HUID kaise check karun" ? ["6-digit PIN"] : [],
  });
}

const groups = [
  ["labs", labs],
  ["file", files],
  ["verify", verifies],
  ["normal", normal],
];

const bad = [];
for (const [name, rows] of groups) {
  assert.equal(rows.length, 100, name);
  for (const row of rows) {
    const kind = deskKind(row.q);
    const loc = needsDeviceLocation(row.q);
    const reply = deskReply(row.q) || "";
    const problems = [];
    if (kind !== row.kind) problems.push(`kind ${kind} != ${row.kind}`);
    if (loc !== row.loc) problems.push(`location ${loc} != ${row.loc}`);
    if (row.loc && !/PIN|pin/i.test(reply) && kind === "labs") problems.push("location ask missing PIN line");
    for (const bit of row.must || []) if (!reply.includes(bit)) problems.push(`missing ${bit}`);
    for (const bit of row.ban || []) if (reply.includes(bit)) problems.push(`banned ${bit}`);
    if (name !== "labs" && loc) problems.push("location leaked");
    if (problems.length) bad.push({ name, q: row.q, problems });
  }
}

if (bad.length) {
  console.log(JSON.stringify(bad.slice(0, 30), null, 2));
  console.log(`failed ${bad.length} / 400`);
  process.exit(1);
}
console.log("location gate 400/400");
