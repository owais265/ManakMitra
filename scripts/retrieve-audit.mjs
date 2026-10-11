import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": "/workspace/src" } });
const { retrieve } = jiti("/workspace/src/lib/retrieve.ts");
const { matchProductFamily, isHallmarkSchemeMix } = jiti("/workspace/src/lib/product-playbook.ts");

const file = process.argv[2];
const bugs = new Map();
function bug(code, sample) {
  let row = bugs.get(code);
  if (!row) { row = { n: 0, samples: [] }; bugs.set(code, row); }
  row.n++;
  if (row.samples.length < 4) row.samples.push(sample);
}
function parseCsv(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
const NONJ = /\b(fan|cement|helmet|laptop|cooker|heater|tyre|pipe|toy|soap|milk|bottle|glass|switch|iron)\b/i;
let rows = 0, miss = 0, hypo = 0;
const byMod = new Map();
const t0 = Date.now();
const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
let header = true;
for await (const line of rl) {
  if (header) { header = false; continue; }
  if (!line) continue;
  const cols = parseCsv(line);
  if (cols.length < 3) continue;
  const [id, query, target] = cols;
  rows++;
  const r = retrieve(query);
  const top = r.hits[0]?.title || "";
  const blob = r.hits.slice(0, 4).map((h) => h.title).join(" | ");
  byMod.set(target + (r.hasEvidence ? ":hit" : ":miss"), (byMod.get(target + (r.hasEvidence ? ":hit" : ":miss")) || 0) + 1);
  if (!r.hasEvidence) { miss++; bug("no-evidence", `${id} | ${target} | ${query.slice(0, 140)}`); }
  if (/hypothetical \/ policy/i.test(top)) {
    hypo++;
    const fam = matchProductFamily(query);
    if (fam && target !== "Chatbot General") bug("hypo-over-product", `${id} | ${target} | ${fam.id} | ${query.slice(0, 120)}`);
    else if (fam && /\b(standard|isi|which|kaunsa|applicable)\b/i.test(query)) bug("hypo-over-ask", `${id} | ${fam.id} | ${query.slice(0, 120)}`);
  }
  const ism = query.match(/\bIS[\s/.-]*(\d{3,5})\b/i);
  if (ism && r.hasEvidence && !blob.includes(ism[1]) && !/not in this catalogue/i.test(blob)) {
    bug("named-is-missing", `${id} | IS ${ism[1]} | ${blob.slice(0, 100)} | ${query.slice(0, 80)}`);
  }
  if (NONJ.test(query) && /\bhuid\b/i.test(query) && /1417|1418|22 carat|22k/i.test(top) && !/applies only to jewellery/i.test(blob)) {
    bug("scheme-mix-became-gold", `${id} | ${top.slice(0, 60)} | ${query.slice(0, 100)}`);
  }
  if (isHallmarkSchemeMix(query) && NONJ.test(query) && !/applies only to jewellery|17870|269|2925|5522/i.test(blob) && /1417|22 carat/i.test(top)) {
    bug("mix-gold-top", `${id} | ${query.slice(0, 100)}`);
  }
  if (rows % 50000 === 0) console.error(JSON.stringify({ file: file.split("/").pop(), rows, miss, hypo, sec: ((Date.now()-t0)/1000)|0 }));
}
console.log(JSON.stringify({
  file: file.split("/").pop(),
  rows, miss, hypo, sec: ((Date.now()-t0)/1000)|0,
  byMod: [...byMod.entries()].sort((a,b)=>b[1]-a[1]),
  bugs: [...bugs.entries()].map(([code, row]) => ({ code, n: row.n, samples: row.samples })),
}, null, 2));
