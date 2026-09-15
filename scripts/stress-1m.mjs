#!/usr/bin/env node
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { createJiti } from "jiti";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const N = 2;
const QPATH = "/tmp/mm1m_questions.json";
const OUT = "/tmp/mm1m_audit.json";
const self = fileURLToPath(import.meta.url);

const FORBID = /^(IS\s*4151|IS\s*7397|IS\s*14756|IS\s*14543|IS\s*13428|IS\s*1671)\b/i;
const HALL_VERIFY = /how can a consumer verify a huid|gold 22 carat|gold 18 carat|hallmark \/ huid verification$/i;
const HONEST_MIX = /hallmark \/ huid applies only to jewellery/i;
const SOP =
  /pack has no sop|not in this catalogue|officer \/ branch-head|eco mark is a separate|is number vs product|agmark is not|unknown portal|stop marking|penalt|fake bis/i;

function verdictOf(intent, fam, mix, r) {
  const titles = (r.hits || []).slice(0, 3).map((h) => h.title);
  const top = titles[0] || "-";
  const topKind = r.hits[0]?.kind || "-";
  if (intent !== "bis") return ["INTENT", top];
  if (titles.some((t) => FORBID.test(t))) return ["FORBID", top];
  if (!r.hasEvidence) return ["EMPTY", top];
  if (mix && HALL_VERIFY.test(top) && !HONEST_MIX.test(top)) return ["MIX_HUID", top];
  if (mix && HONEST_MIX.test(top)) return ["OK_MIX_HONEST", top];
  if (fam?.scheme === "hallmark" && /crs r-number|same scheme-i \/ crs/i.test(top)) return ["MIX_CRS", top];
  if (topKind === "standard" && !fam && /IS\s+\d+/i.test(top)) return ["DUMP_IS", top];
  if (SOP.test(top)) return ["OK_REFUSE", top];
  return ["OK", top];
}

if (isMainThread) {
  const qs = JSON.parse(readFileSync(QPATH, "utf8"));
  console.log("main loaded", qs.length);
  const chunk = Math.ceil(qs.length / N);
  const parts = [];
  let done = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const start = i * chunk;
    const end = Math.min(qs.length, start + chunk);
    const w = new Worker(self, { workerData: { start, end, i } });
    w.on("message", (msg) => {
      if (msg.type === "progress") {
        console.log(`w${msg.i} ${msg.n}/${msg.end - msg.start} ${msg.n > 0 ? ((Date.now() - t0) / msg.n).toFixed(1) : 0}ms/q`);
        return;
      }
      parts[msg.i] = msg;
      done++;
      console.log("worker done", msg.i, msg.processed);
      if (done === N) {
        const by = {};
        const samples = {};
        let processed = 0;
        for (const p of parts) {
          processed += p.processed;
          for (const [k, v] of Object.entries(p.by)) by[k] = (by[k] || 0) + v;
          for (const [k, arr] of Object.entries(p.samples)) {
            samples[k] = (samples[k] || []).concat(arr).slice(0, 12);
          }
        }
        const honest = (by.OK || 0) + (by.OK_REFUSE || 0) + (by.OK_MIX_HONEST || 0);
        const out = {
          processed,
          expected: qs.length,
          skipped: qs.length - processed,
          honest,
          pct: processed ? +(100 * honest / processed).toFixed(3) : 0,
          verdicts: by,
          samples,
          ms: Date.now() - t0,
        };
        writeFileSync(OUT, JSON.stringify(out, null, 2));
        console.log(JSON.stringify(out, null, 2));
      }
    });
    w.on("error", (e) => {
      console.error("worker error", i, e);
      process.exit(1);
    });
  }
} else {
  const { start, end, i } = workerData;
  const jiti = createJiti(import.meta.url, { alias: { "@": join("/workspace", "src") } });
  const { retrieve } = jiti("/workspace/src/lib/retrieve.ts");
  const { classifyIntent } = jiti("/workspace/src/lib/intent.ts");
  const { matchProductFamily, isHallmarkSchemeMix } = jiti("/workspace/src/lib/product-playbook.ts");
  const qs = JSON.parse(readFileSync(QPATH, "utf8"));
  const by = {};
  const samples = {};
  let processed = 0;
  for (let k = start; k < end; k++) {
    const q = qs[k];
    const intent = classifyIntent(q);
    const fam = matchProductFamily(q);
    const mix = isHallmarkSchemeMix(q, fam);
    const r = intent === "bis" ? retrieve(q) : { hits: [], hasEvidence: false };
    const [v, top] = verdictOf(intent, fam, mix, r);
    by[v] = (by[v] || 0) + 1;
    if (!samples[v]) samples[v] = [];
    if (samples[v].length < 8) samples[v].push({ q: q.slice(0, 140), top: (top || "-").slice(0, 80) });
    processed++;
    if (processed % 25000 === 0) parentPort.postMessage({ type: "progress", i, n: processed, start, end });
  }
  parentPort.postMessage({ type: "done", i, processed, by, samples });
}
