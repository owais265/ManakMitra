#!/usr/bin/env node
/**
 * Jury-facing retrieval harness (no LLM). Exit 1 if a golden rule fails.
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
const { rewriteQuery } = jiti(join(root, "src/lib/query-context.ts"));
const { matchProductFamily } = jiti(join(root, "src/lib/product-playbook.ts"));

function topTitles(hits) {
  return (hits || []).slice(0, 3).map((h) => h.title);
}

function blob(hits) {
  return (hits || []).map((h) => `${h.title} ${h.body}`).join("\n");
}

const cases = [
  {
    id: "cement-hi",
    query: "सीमेंट के लिए कौन सा IS है",
    expectIntent: "bis",
    family: "cement",
    requireTitle: /IS 269\b/,
    requireAny: /scheme-i|isi mark|product certification/i,
    forbid: /IS 4151/,
    hasEvidence: true,
  },
  {
    id: "cement-follow",
    query: "ab process aur fee batao",
    history: [
      { role: "user", text: "सीमेंट के लिए कौन सा IS है" },
      { role: "ai", text: "IS 269 Ordinary portland cement" },
    ],
    expectIntent: "bis",
    family: "cement",
    requireTitle: /IS 269\b/,
    requireAny: /fee|scheme-i|application/i,
    hasEvidence: true,
  },
  {
    id: "helmet",
    query: "helmet ka standard",
    expectIntent: "bis",
    family: "helmet",
    requireAny: /2925|18808|2745/,
    forbid: /IS 4151/,
    hasEvidence: true,
  },
  {
    id: "gold",
    query: "सोने का गहना hallmark HUID",
    expectIntent: "bis",
    family: "gold",
    requireAny: /1417/,
    requireBlob: /hallmark|huid|1418/i,
    hasEvidence: true,
  },
  {
    id: "mixie",
    query: "ghar ke mixer grinder ki standard",
    expectIntent: "bis",
    family: "mixer-kitchen",
    requireAny: /302|14366|14367/,
    forbid: /concrete mixer/i,
    hasEvidence: true,
  },
  {
    id: "laptop",
    query: "laptop certification CRS",
    expectIntent: "bis",
    family: "laptop",
    requireAny: /crs|compulsory registration|13252|62368/i,
    hasEvidence: true,
  },
  {
    id: "raipur-lab",
    query: "Raipur mein cement test lab",
    expectIntent: "bis",
    requireBlob: /raipur/i,
    labOk: true,
    hasEvidence: true,
  },
  {
    id: "complaint",
    query: "BIS complaint kahan file karun",
    expectIntent: "bis",
    requireAny: /complaint|CARE|grievance|शिकायत/i,
    hasEvidence: true,
  },
  {
    id: "ipl",
    query: "IPL winner 2026",
    expectIntent: "offtopic",
    hasEvidence: false,
  },
  {
    id: "flying",
    query: "flying carpet for space tourism",
    expectIntent: "offtopic",
    hasEvidence: false,
  },
  {
    id: "social",
    query: "hi tell about yourself",
    expectIntent: "social",
  },
  {
    id: "clause",
    query: "IS 269 ke clause 5 mein kya likha hai",
    expectIntent: "bis",
    requireTitle: /IS 269\b/,
    requireBlob: /Know Your Standard|e-Sale|clause text is NOT stored/i,
    forbidClauseInvent: true,
    hasEvidence: true,
  },
  {
    id: "training",
    query: "BIS training standards club",
    expectIntent: "bis",
    requireAny: /enquiry|training|directory|contact/i,
    hasEvidence: true,
  },
  { id: "neg-cricket", query: "who won the cricket match", expectIntent: "offtopic" },
  { id: "neg-recipe", query: "how to cook biryani recipe", expectIntent: "offtopic" },
  { id: "neg-medical", query: "diagnose my fever and prescribe medicine", expectIntent: "offtopic" },
  { id: "neg-company", query: "Acme Widgets private limited share price", expectIntent: "offtopic" },
  {
    id: "cable-pvc",
    query: "pvc cable ka IS",
    expectIntent: "bis",
    family: "cable",
    requireTitle: /IS 694\b/,
    hasEvidence: true,
  },
  {
    id: "gas-stove",
    query: "domestic gas stove standard",
    expectIntent: "bis",
    family: "lpg-stove",
    requireTitle: /IS 17153\b/,
    hasEvidence: true,
  },
  {
    id: "who-are-you",
    query: "who are you",
    expectIntent: "social",
  },
  {
    id: "hi-cement",
    query: "hi cement",
    expectIntent: "bis",
    family: "cement",
    requireTitle: /IS 269\b/,
    hasEvidence: true,
  },
  {
    id: "clause-repeat",
    query: "IS 269 ke clause 5 mein kya likha hai",
    expectIntent: "bis",
    requireTitle: /IS 269\b/,
    requireBlob: /Know Your Standard|e-Sale|clause text is NOT stored/i,
    hasEvidence: true,
  },
  {
    id: "ipl-repeat",
    query: "IPL winner 2026",
    expectIntent: "offtopic",
    hasEvidence: false,
  },
];

const rows = [];
let failed = 0;

for (const c of cases) {
  const intent = classifyIntent(c.query, c.history);
  const rq = rewriteQuery(c.query, c.history);
  const family = matchProductFamily(rq) || matchProductFamily(c.query);
  let r = { hits: [], hasEvidence: false };
  if (intent === "bis") r = retrieve(rq);

  const titles = topTitles(r.hits);
  const text = blob(r.hits);
  const reasons = [];

  if (c.expectIntent && intent !== c.expectIntent) reasons.push(`intent ${intent} != ${c.expectIntent}`);
  if (c.family && family?.id !== c.family) reasons.push(`family ${family?.id || "none"} != ${c.family}`);
  if (c.hasEvidence === true && !r.hasEvidence) reasons.push("expected evidence");
  if (c.hasEvidence === false && r.hasEvidence && intent !== "offtopic") reasons.push("unexpected evidence");
  if (c.expectIntent === "offtopic" && r.hasEvidence) reasons.push("offtopic must not retrieve");
  if (c.requireTitle && !titles.some((t) => c.requireTitle.test(t)))
    reasons.push(`top titles miss ${c.requireTitle}: ${titles.join(" | ")}`);
  if (c.requireAny && !titles.some((t) => c.requireAny.test(t)) && !c.requireAny.test(text))
    reasons.push(`no title/body match ${c.requireAny}`);
  if (c.requireBlob && !c.requireBlob.test(text)) reasons.push("blob missing required note/portal");
  if (c.forbid && titles.some((t) => c.forbid.test(t))) reasons.push("forbidden string in titles");
  if (c.forbidClauseInvent && /clause\s*5[^.]*says|clause 5 states/i.test(text)) reasons.push("invented clause");
  if (c.labOk && !/raipur/i.test(text)) reasons.push("no Raipur lab row");
  if (c.labOk && /accredited for IS 269/i.test(text)) reasons.push("claimed IS-specific accreditation");

  const pass = reasons.length === 0;
  if (!pass) failed += 1;
  rows.push({
    id: c.id,
    pass,
    intent,
    family: family?.id || null,
    hasEvidence: r.hasEvidence,
    top3: titles,
    reasons,
  });
}

console.log(JSON.stringify({ failed, total: rows.length, rows }, null, 2));
process.exit(failed ? 1 : 0);
