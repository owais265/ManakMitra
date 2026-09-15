#!/usr/bin/env node
/**
 * Standalone-query harness (no LLM, no conversation fold).
 */
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": join(root, "src") },
});

const { retrieve } = jiti(join(root, "src/lib/retrieve.ts"));
const { classifyIntent } = jiti(join(root, "src/lib/intent.ts"));
const { rewriteQueryDebug } = jiti(join(root, "src/lib/query-context.ts"));
const { matchProductFamily } = jiti(join(root, "src/lib/product-playbook.ts"));

const cases = [
  {
    id: "cement-fees",
    query: "cement fees?",
    expectIntent: "bis",
    expectFamily: "cement",
    rewriteNeed: [/fee/i, /cement/i],
    rewriteForbid: /1417/,
    topNeed: /IS 269\b/,
  },
  {
    id: "pvc-lab",
    query: "PVC Pipes lab",
    expectIntent: "bis",
    expectFamily: "pvc-pipe",
    rewriteNeed: [/lab/i, /pvc|pipe/i],
    topNeed: /IS 4985\b/,
    forbidTop: /IS 302|IS 18243/,
  },
  {
    id: "gold-process",
    query: "916 gold process",
    expectIntent: "bis",
    expectFamily: "gold",
    rewriteNeed: [/process/i],
    topNeed: /1417|1418/,
  },
  {
    id: "cement-related",
    query: "cement related",
    expectIntent: "bis",
    expectFamily: "cement",
    rewriteNeed: [/related/i],
    topNeed: /269|portland|cement/i,
    forbidTop: /IS 1417|CARE app/i,
  },
  {
    id: "hi-cement",
    query: "hi cement",
    expectIntent: "bis",
    expectFamily: "cement",
    followCue: false,
    topNeed: /IS 269\b/,
  },
  {
    id: "who-are-you-fees",
    query: "fees?",
    expectIntent: "social",
    followCue: true,
    rewriteForbid: /269/,
    noEvidence: true,
  },
  {
    id: "gold-to-cement",
    query: "what about cement",
    expectIntent: "bis",
    expectFamily: "cement",
    switched: "cement",
    followCue: false,
    topNeed: /IS 269\b/,
    forbidTop: /IS 1417|IS 1418/,
  },
  {
    id: "who-won-match",
    query: "who won the match",
    expectIntent: "offtopic",
    noEvidence: true,
  },
  {
    id: "care-app",
    query: "How to use BIS CARE app?",
    expectIntent: "bis",
    topNeed: /CARE/i,
    top1: /CARE/i,
  },
  {
    id: "training-club",
    query: "BIS training workshop standards club",
    expectIntent: "bis",
    top1: /enquiry|training|directory|contact|club/i,
    forbidTopRest: /^What is BIS$/i,
  },
  {
    id: "bare-fees-no-leak",
    query: "fees?",
    expectIntent: "social",
    followCue: true,
    rewriteForbid: /269|4985|1417/,
    noEvidence: true,
  },
];

let failed = 0;
const rows = [];

for (const c of cases) {
  const intent = classifyIntent(c.query);
  const dbg = rewriteQueryDebug(c.query);
  const family = matchProductFamily(dbg.rewritten) || matchProductFamily(c.query);
  let r = { hits: [], hasEvidence: false };
  if (intent === "bis") r = retrieve(dbg.rewritten);
  const titles = (r.hits || []).slice(0, 3).map((h) => h.title);
  const reasons = [];

  if (intent !== c.expectIntent) reasons.push(`intent ${intent} != ${c.expectIntent}`);
  if (c.expectFamily && family?.id !== c.expectFamily) reasons.push(`family ${family?.id || "none"} != ${c.expectFamily}`);
  if (c.followCue === true && !dbg.isFollowCue) reasons.push("expected isFollowCue");
  if (c.followCue === false && dbg.isFollowCue) reasons.push("unexpected isFollowCue");
  if (c.switched && dbg.switchedFamily !== c.switched) reasons.push(`switch ${dbg.switchedFamily} != ${c.switched}`);
  for (const re of c.rewriteNeed || []) {
    if (!re.test(dbg.rewritten)) reasons.push(`rewrite miss ${re}`);
  }
  if (c.rewriteForbid && c.rewriteForbid.test(dbg.rewritten)) reasons.push("rewrite leaked old IS");
  if (c.topNeed && !titles.some((t) => c.topNeed.test(t))) reasons.push(`top miss ${c.topNeed}: ${titles.join(" | ")}`);
  if (c.top1 && !c.top1.test(titles[0] || "")) reasons.push(`top-1 miss ${c.top1}: ${titles[0] || ""}`);
  if (c.forbidTop && titles.some((t) => c.forbidTop.test(t))) reasons.push(`forbid in top3: ${titles.join(" | ")}`);
  if (c.forbidTopRest && titles.slice(1, 3).some((t) => c.forbidTopRest.test(t))) reasons.push("What is BIS in top-2/3");
  if (c.noEvidence && r.hasEvidence) reasons.push("unexpected evidence");
  if (c.expectIntent === "offtopic" && r.hasEvidence) reasons.push("offtopic retrieved");

  const pass = reasons.length === 0;
  if (!pass) failed += 1;
  const line = {
    query: c.query,
    rewrittenOk: (c.rewriteNeed || []).every((re) => re.test(dbg.rewritten)),
    intent,
    top1: titles[0] || "",
    followCue: dbg.isFollowCue,
    family: family?.id || null,
    pass,
    reasons,
  };
  rows.push({ id: c.id, ...line });
  console.log(JSON.stringify({ id: c.id, ...line }));
}

console.log("");
console.log("case | intent | followCue | family | top1 | pass");
console.log("-----|--------|-----------|--------|------|-----");
for (const row of rows) {
  console.log(
    `${row.id} | ${row.intent} | ${row.followCue} | ${row.family || "-"} | ${(row.top1 || "-").slice(0, 40)} | ${row.pass ? "PASS" : "FAIL"}`,
  );
}
console.log(`\n${rows.length - failed}/${rows.length} pass`);
process.exit(failed ? 1 : 0);
