/**
 * Stream both million-row UI sheets through the real routers.
 * No LLM. Counts every row. Keeps a few samples per failure.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createJiti } from "jiti";
import { join } from "node:path";

const jiti = createJiti(import.meta.url, { alias: { "@": join("/workspace", "src") } });
const { moreKind, checkHuid, findHallmark, moreReply } = jiti("/workspace/src/lib/more-desk.ts");
const { deskKind, needsDeviceLocation } = jiti("/workspace/src/lib/desk-route.ts");
const { cityToPin } = jiti("/workspace/src/lib/labs.ts");
const { matchProductFamily } = jiti("/workspace/src/lib/product-playbook.ts");

const FILES = process.argv.slice(2);

const bugs = new Map();
function bug(code, sample) {
  let row = bugs.get(code);
  if (!row) {
    row = { n: 0, samples: [] };
    bugs.set(code, row);
  }
  row.n += 1;
  if (row.samples.length < 3) row.samples.push(sample);
}

function parseCsv(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const modules = new Map();
const missCities = new Map();
const missProducts = new Map();
let rows = 0;
let badCsv = 0;

function cityOf(query) {
  const m = query.match(/\b(?:in|near)\s+([A-Za-z][A-Za-z .'-]{2,40})(?:\?|$)/);
  return m ? m[1].trim() : "";
}

function check(id, query, target) {
  const kind = moreKind(query);
  const desk = deskKind(query);
  const key = `${target}|${kind || "-"}|${desk || "-"}`;
  modules.set(key, (modules.get(key) || 0) + 1);

  if (target === "HUID Verification") {
    if (kind !== "huid") bug("huid-not-routed", `${id} | ${query} | kind=${kind} desk=${desk}`);
    else if (desk === "file" || desk === "labs") bug("huid-stolen-by-desk", `${id} | ${query} | desk=${desk}`);
    const checked = checkHuid(query);
    if (checked.status === "ok" && /^(FAN|MARK|TEST|FAKE|GOLD|TOY|CEM|ISI|BIS|LAB|PIPE|BULB|SOAP|MILK)/.test(checked.code)) {
      bug("huid-block-leaked", `${id} | ${checked.code}`);
    }
    return;
  }
  if (target === "Product File") {
    if (desk !== "file") bug("file-not-routed", `${id} | ${query} | kind=${kind} desk=${desk}`);
    return;
  }
  if (target === "Verify Product") {
    const photo = /photo/i.test(query);
    const brand = /brand name/i.test(query);
    const licence = /CM\/L|R-\d/.test(query);
    if (licence && desk !== "verify") bug("verify-licence-miss", `${id} | ${query} | desk=${desk} kind=${kind}`);
    if (photo && desk === "labs") bug("verify-photo-became-lab", `${id} | ${query}`);
    if (!licence && !photo && !brand && desk !== "verify" && kind !== "huid") {
      bug("verify-unhandled", `${id} | ${query} | kind=${kind} desk=${desk}`);
    }
    return;
  }
  if (target === "Find a Laboratory") {
    if (desk !== "labs") bug("lab-not-routed", `${id} | ${query} | kind=${kind} desk=${desk}`);
    const device = /device location/i.test(query);
    const pin = /(?<!IS[\s/.-]*)\b[1-9][0-9]{5}\b/.test(query);
    const city = cityToPin(query);
    const ask = device ? needsDeviceLocation(query) : false;
    if (device && !ask) bug("lab-device-not-asked", `${id} | ${query}`);
    if (!device && !pin && !city) {
      const named = cityOf(query);
      if (named) missCities.set(named, (missCities.get(named) || 0) + 1);
      else bug("lab-pin-missed", `${id} | ${query}`);
    }
    return;
  }
  if (target === "Hallmark Finder") {
    if (kind !== "hallmark") bug("hallmark-not-routed", `${id} | ${query} | kind=${kind} desk=${desk}`);
    const found = findHallmark(query);
    if (/\b24\s*k\b/i.test(query) && found.grade) bug("hallmark-24k-invented", `${id} | ${found.grade.id}`);
    if (/\b925\b/.test(query) && /\bgold\b/i.test(query) && found.grade?.metal === "gold") {
      bug("hallmark-925-called-gold", `${id} | ${query}`);
    }
    return;
  }
  if (target === "Indian Standards Finder") {
    if (kind !== "standards") bug("standards-not-routed", `${id} | ${query} | kind=${kind} desk=${desk}`);
    const family = matchProductFamily(query);
    if (!family) {
      const product = query.replace(/^.*\b(?:for|standard)\s+/i, "").replace(/\?$/, "").trim();
      missProducts.set(product, (missProducts.get(product) || 0) + 1);
    }
    return;
  }
  if (target === "Chatbot General") {
    if (desk === "file") bug("chat-stolen-by-file", `${id} | ${query}`);
    if (desk === "labs") bug("chat-stolen-by-labs", `${id} | ${query}`);
    if (kind === "huid" && !/\bhuid\b/i.test(query)) bug("chat-stolen-by-huid", `${id} | ${query}`);
    return;
  }
  bug("unknown-target", `${id} | ${target}`);
}

async function scan(path) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let header = true;
  for await (const line of rl) {
    if (header) {
      header = false;
      continue;
    }
    if (!line) continue;
    const cols = parseCsv(line);
    if (cols.length < 3) {
      badCsv += 1;
      continue;
    }
    rows += 1;
    check(cols[0], cols[1], cols[2]);
    if (rows % 200000 === 0) console.error("rows", rows);
  }
}

const t0 = Date.now();
for (const file of FILES) await scan(file);
console.log(JSON.stringify({
  rows,
  badCsv,
  ms: Date.now() - t0,
  bugs: [...bugs.entries()].map(([code, row]) => ({ code, n: row.n, samples: row.samples })),
  routes: [...modules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40),
  missCities: [...missCities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
  missProducts: [...missProducts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30),
}, null, 2));
void moreReply;
