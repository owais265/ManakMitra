#!/usr/bin/env node
/**
 * Jury metrics M1–M10 (no LLM). Retrieval accuracy + pack extractability.
 * Exit 1 if any metric fails its threshold.
 */
import { createJiti } from "jiti";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const { retrieve, groundedFallback } = jiti(join(root, "src/lib/retrieve.ts"));
const { classifyIntent, socialReply } = jiti(join(root, "src/lib/intent.ts"));
const { rewriteQueryDebug, isFollowCue } = jiti(join(root, "src/lib/query-context.ts"));
const { listProductFamilies, matchProductFamily, shouldClarify } = jiti(
  join(root, "src/lib/product-playbook.ts"),
);
const { APP_LANGS, UI_DICTIONARY, FALLBACK_SHELL } = jiti(join(root, "src/lib/language.ts"));

function loadJson(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

function isOfficialHost(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return (
      h === "bis.gov.in" ||
      h.endsWith(".bis.gov.in") ||
      h === "manakonline.in" ||
      h.endsWith(".manakonline.in") ||
      h === "crsbis.in" ||
      h.endsWith(".crsbis.in") ||
      h === "standardsbis.bsbedge.com" ||
      h === "india.gov.in" ||
      h.endsWith(".india.gov.in")
    );
  } catch {
    return false;
  }
}

function titleHasIs(text, n) {
  return new RegExp(`IS\\s*${n}\\b`, "i").test(text || "");
}

function englishAlias(family) {
  return (
    family.aliases.find((a) => /[A-Za-z]/.test(a) && a.length >= 4) ||
    family.aliases[0] ||
    family.id
  );
}

function hitBlob(hits) {
  return (hits || []).map((h) => `${h.title} ${h.body} ${h.url}`).join("\n");
}

const pack = loadJson("src/data/rag-pack.json") || { chunks: [], catalogue: [] };
const boost = loadJson("src/data/verified-boost.json") || [];
const knowledge = loadJson("data/manakmitra_bis_knowledge.json") || {};

const families = listProductFamilies();
const rows = [];

function add(metric, id, pass, detail) {
  rows.push({ metric, id, pass, detail: detail || "" });
}

/* M1 family pin + M2 Retrieval@3 */
for (const f of families) {
  if (f.disambiguate && !f.is.length) continue;
  const alias = englishAlias(f);
  const q = `${alias} BIS standard`;
  const fam = matchProductFamily(q);
  const r = retrieve(q);
  const top3 = (r.hits || []).slice(0, 3);
  const titles = top3.map((h) => h.title).join(" | ");
  const blob = hitBlob(top3);
  const familyOk = fam?.id === f.id;
  add("M1", `family-${f.id}`, familyOk, familyOk ? fam.id : `${fam?.id || "none"} != ${f.id} | ${q}`);
  if (f.is.length) {
    const okIs = f.is.some((n) => top3.some((h) => titleHasIs(h.title, n) || titleHasIs(h.body, n)));
    const okCrs =
      f.scheme === "crs" &&
      top3.some((h) => h.kind === "crs" || /crs|compulsory registration|photovoltaic/i.test(`${h.title} ${h.body}`));
    const ok = okIs || okCrs;
    add("M2", `r3-${f.id}`, ok, ok ? titles : `miss IS ${f.is.join("/")} | ${titles}`);
  } else if (f.scheme === "crs") {
    const ok = top3.some(
      (h) => h.kind === "crs" || /crs|compulsory registration/i.test(`${h.title} ${h.body}`),
    );
    add("M2", `r3-${f.id}`, ok, ok ? titles : `miss CRS product | ${titles}`);
  }
}

/* M3 hallucination-0 + M7 offtopic */
const offtopic = [
  "IPL winner 2026",
  "who won the cricket match",
  "how to cook biryani recipe",
  "diagnose my fever and prescribe medicine",
  "flying carpet for space tourism",
  "who won the match",
];
for (const q of offtopic) {
  const intent = classifyIntent(q);
  const r = intent === "bis" ? retrieve(q) : { hits: [], hasEvidence: false };
  const ok = intent === "offtopic" && !r.hasEvidence;
  add("M7", `off-${q.slice(0, 40)}`, ok, ok ? "reject" : `intent=${intent} ev=${r.hasEvidence}`);
  add("M3", `hallu-off-${q.slice(0, 28)}`, ok, ok ? "no retrieve" : "offtopic leaked catalogue");
}

const invented = [
  { q: "helmet ka standard", forbidTitle: /^IS\s*4151\b/i },
  { q: "helmet ka standard", forbidTitle: /^IS\s*1671\b/i },
  { q: "What does 916 gold mean in BIS?", forbidTitle: /^IS\s*916\s*:/i },
  { q: "packaged drinking water BIS standard", forbidTitle: /^IS\s*14543\b/i },
  { q: "What standard covers stainless steel sheets used for utensils?", forbidTitle: /^IS\s*7397\b/i },
  { q: "What standard covers stainless steel sheets used for utensils?", forbidTitle: /^IS\s*14756\b/i },
];
for (const c of invented) {
  const r = retrieve(c.q);
  const titles = (r.hits || []).map((h) => h.title).join(" | ");
  const ok = !(r.hits || []).some((h) => c.forbidTitle.test(h.title));
  add("M3", `hallu-${c.q.slice(0, 28)}`, ok, ok ? "clean" : `invented in titles: ${titles}`);
}

/* M4 official URL 100% */
const allRows = [
  ...(pack.chunks || []).map((c) => ({ ...c, layer: "chunk" })),
  ...(Array.isArray(boost) ? boost : []).map((c) => ({ ...c, layer: "boost" })),
  ...(pack.catalogue || []).map((c) => ({ ...c, layer: "catalogue" })),
];
const unofficial = [];
for (const c of allRows) {
  const url = c.url || "";
  if (!url) continue;
  if (/google\.com\/search/i.test(url) || !isOfficialHost(url)) {
    unofficial.push({ layer: c.layer, title: c.title, url });
  }
}
add("M4", "pack-urls", unofficial.length === 0, unofficial.length ? JSON.stringify(unofficial.slice(0, 5)) : "all official");

const probeQs = [
  "how to apply for ISI mark",
  "laptop certification CRS",
  "cement ke liye fees",
  "Raipur mein cement test lab",
  "CRS R-number verify",
  "BIS CARE app",
];
for (const q of probeQs) {
  const r = retrieve(q);
  const bad = (r.hits || []).filter((h) => h.url && (/google\.com\/search/i.test(h.url) || !isOfficialHost(h.url)));
  const fb = groundedFallback(q, "en");
  const fbBad = /google\.com\/search/i.test(fb) || /([^a-z]|^)akonline\.in/i.test(fb);
  add("M4", `live-${q.slice(0, 28)}`, bad.length === 0 && !fbBad, bad[0]?.url || (fbBad ? "fallback host" : "ok"));
}

/* M5 clarify-first */
const clarifyQs = ["hallmark", "helmet", "pipe", "mixer"];
for (const q of clarifyQs) {
  const msg = shouldClarify(q);
  add("M5", `clarify-${q}`, Boolean(msg), msg || "no disambiguate");
}
add("M5", "clarify-not-916", !shouldClarify("916 gold HUID"), "specific must not clarify");

/* M6 scheme mix-up 0 */
{
  const r = retrieve("CRS R-number verify");
  const fb = groundedFallback("CRS R-number verify", "en");
  const ok = !/Tap Verify HUID|Enter the 6-digit HUID|Apply online as jeweller/i.test(fb);
  add("M6", "crs-not-huid", ok, ok ? "crs path" : "HUID/jeweller leaked");
}
{
  const fb = groundedFallback("how to apply for ISI mark", "en");
  const ok = /manakonline\.in/i.test(fb) && !/([^a-z]|^)akonline\.in/i.test(fb);
  add("M6", "isi-manak", ok, ok ? "manakonline" : fb.slice(0, 180));
}
{
  const fb = groundedFallback("verify HUID", "en");
  const ok = /CARE|Verify HUID/i.test(fb) && !/Apply online as jeweller|Get instant registration/i.test(fb);
  add("M6", "huid-not-jeweller", ok, ok ? "CARE path" : "jeweller leaked");
}
{
  const r = retrieve("laptop certification CRS");
  const blob = hitBlob(r.hits);
  const ok = /crs|crsbis|laptop|notebook/i.test(blob);
  add("M6", "laptop-crs", ok, ok ? "crs" : "scheme miss");
}

/* M8 standalone query — no history fold / no IS leak */
const follow = [
  {
    id: "fees-cue-standalone",
    query: "fees?",
    forbid: /269/,
    cue: true,
    social: true,
  },
  {
    id: "switch-cement",
    query: "what about cement",
    need: [/cement/i],
    family: "cement",
    cue: false,
  },
  {
    id: "cement-fees-named",
    query: "cement fees?",
    need: [/cement/i, /fee/i],
    family: "cement",
    cue: false,
  },
];
for (const c of follow) {
  const dbg = rewriteQueryDebug(c.query);
  const intent = classifyIntent(c.query);
  const reasons = [];
  if (c.cue === true && !dbg.isFollowCue && !isFollowCue(c.query)) reasons.push("cue miss");
  if (c.cue === false && dbg.isFollowCue) reasons.push("unexpected cue");
  for (const re of c.need || []) if (!re.test(dbg.rewritten)) reasons.push(`rewrite miss ${re}`);
  if (c.forbid && c.forbid.test(dbg.rewritten)) reasons.push("rewrite leaked");
  if (c.family && matchProductFamily(dbg.rewritten)?.id !== c.family) reasons.push("family miss");
  if (c.social && intent !== "social") reasons.push(`intent ${intent}`);
  add("M8", c.id, reasons.length === 0, reasons.join("; ") || dbg.rewritten.slice(0, 80));
}

/* M9 multilingual lock */
for (const l of APP_LANGS) {
  const ui = UI_DICTIONARY[l.id];
  const sh = FALLBACK_SHELL[l.id];
  const social = socialReply(l.id);
  const reasons = [];
  if (!ui?.welcomeTitle || !ui?.composerPlaceholder) reasons.push("ui pack");
  if (!sh?.title || !sh?.refuse) reasons.push("fallback pack");
  if (l.id !== "en" && ui.composerPlaceholder === UI_DICTIONARY.en.composerPlaceholder) reasons.push("composer still EN");
  if (l.id !== "en" && sh.title === FALLBACK_SHELL.en.title) reasons.push("fallback still EN");
  if (!social.includes("[FOLLOW_UP]") || !social.includes("[META]")) reasons.push("tags");
  add("M9", `lang-${l.id}`, reasons.length === 0, reasons.join("; ") || l.native);
}

/* M10 clause honesty */
{
  const q = "IS 269 ke clause 5 mein kya likha hai";
  const r = retrieve(q);
  const blob = hitBlob(r.hits);
  const fb = groundedFallback(q, "en");
  const ok =
    /Know Your Standard|e-Sale|clause text is NOT stored/i.test(`${blob}\n${fb}`) &&
    !/clause\s*5[^.]*says|clause 5 states/i.test(`${blob}\n${fb}`);
  add("M10", "clause-269", ok, ok ? "honest" : "missing portal note or invented clause");
}

/* Ingestion / extractability (reported, does not fail M* unless unofficial) */
function compact(s) {
  return (s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const packTitles = new Set(
  [...(pack.chunks || []), ...(Array.isArray(boost) ? boost : [])].map((c) => compact(c.title)),
);
const explore = knowledge.explore_bis || [];
const crsScheme = knowledge.crs_scheme || [];
const knCrs = knowledge.crs_products || [];
const packCrs = (pack.chunks || []).filter((c) => c.kind === "crs");
const exploreUnused = explore.filter((e) => {
  const t = compact(e.title);
  return t && ![...packTitles].some((p) => p.includes(t.slice(0, 28)) || t.includes(p.slice(0, 28)));
});
const knCrsUnused = knCrs.filter((p) => {
  const t = compact(p.product);
  return t && !packCrs.some((c) => {
    const x = compact(c.title);
    return x.includes(t.slice(0, 18)) || t.includes(x.slice(0, 18));
  });
});

const labs = (pack.chunks || []).filter((c) => c.kind === "lab");
const emptyCity = labs.filter((c) => {
  const m = (c.body || "").match(/City\s+(.*?)\.\s*State/i);
  return !(m && m[1].trim());
}).length;

function rate(metric) {
  const xs = rows.filter((r) => r.metric === metric);
  const pass = xs.filter((r) => r.pass).length;
  return { metric, pass, total: xs.length, pct: xs.length ? Math.round((1000 * pass) / xs.length) / 10 : 0, fails: xs.filter((r) => !r.pass).map((r) => r.id) };
}

const METRIC_META = {
  M1: { name: "Family pin", threshold: 100 },
  M2: { name: "Retrieval@3", threshold: 95 },
  M3: { name: "Hallucination-0", threshold: 100 },
  M4: { name: "Official URL 100%", threshold: 100 },
  M5: { name: "Clarify-first", threshold: 100 },
  M6: { name: "Scheme mix-up 0", threshold: 100 },
  M7: { name: "Offtopic reject", threshold: 100 },
  M8: { name: "Standalone query (no history fold)", threshold: 100 },
  M9: { name: "Multilingual lock", threshold: 100 },
  M10: { name: "Clause honesty", threshold: 100 },
};

const byMetric = Object.keys(METRIC_META).map((k) => {
  const r = rate(k);
  const meta = METRIC_META[k];
  const ok = r.pct + 1e-9 >= meta.threshold;
  return { ...r, name: meta.name, threshold: meta.threshold, ok };
});

const failedMetrics = byMetric.filter((m) => !m.ok);
const report = {
  ok: failedMetrics.length === 0,
  jury: byMetric,
  failed: failedMetrics.map((m) => m.metric),
  failRows: rows.filter((r) => !r.pass),
  ingestion: {
    chunks: (pack.chunks || []).length,
    catalogue: (pack.catalogue || []).length,
    boost: Array.isArray(boost) ? boost.length : 0,
    exploreBisUsed: `${explore.length - exploreUnused.length}/${explore.length}`,
    crsSchemeNotes: crsScheme.length,
    knowledgeCrsLinked: `${knCrs.length - knCrsUnused.length}/${knCrs.length}`,
    knowledgeCrsUnlinked: knCrsUnused.map((p) => p.product).slice(0, 12),
    emptyCityLabsInPackFile: emptyCity,
    isoIecAdoptedNotDumped: (knowledge.iso_iec_for_india?.adopted_from_catalogue || []).length,
    note: "ISO/IEC adopted list is catalogue-linked metadata — not extra overlapping retrieve rows. Paid clauses not stored.",
  },
};

console.log(JSON.stringify(report, null, 2));
if (failedMetrics.length) {
  console.error(
    `eval:metrics FAIL — ${failedMetrics.map((m) => `${m.metric} ${m.pct}% < ${m.threshold}%`).join("; ")}`,
  );
  process.exit(1);
}
process.exit(0);
