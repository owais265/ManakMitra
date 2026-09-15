#!/usr/bin/env node
/**
 * Live pack coverage audit (no LLM).
 * Exit 1 only on unofficial-host SOURCE urls.
 * Empty city / state abbrev split / generic homepage / missing playbook IS = FLAGS.
 */
import { createJiti } from "jiti";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, {
  alias: { "@": join(root, "src") },
});

const { listProductFamilies } = jiti(join(root, "src/lib/product-playbook.ts"));

function mustJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`missing/invalid ${label}: ${e.message}`);
    process.exit(1);
  }
}

const pack = mustJson(join(root, "src/data/rag-pack.json"), "rag-pack");
const boost = mustJson(join(root, "src/data/verified-boost.json"), "verified-boost");
const chunks = Array.isArray(pack.chunks) ? pack.chunks : [];
const catalogue = Array.isArray(pack.catalogue) ? pack.catalogue : [];
const boostRows = Array.isArray(boost) ? boost : [];

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

function isBareBisHome(url) {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h !== "bis.gov.in") return false;
    const path = (u.pathname || "/").replace(/\/+$/, "") || "/";
    return path === "/" && !u.search;
  } catch {
    return false;
  }
}

function titleHasIs(title, n) {
  return new RegExp(`IS\\s*${n}\\b`, "i").test(title || "");
}

function parseLabFields(body) {
  const cityM = (body || "").match(/City\s+(.*?)\.\s*State/i);
  const city = (cityM ? cityM[1] : "").trim();
  const stateM = (body || "").match(/State\s+(.*?)\.\s*OSL/i) || (body || "").match(/State\s+(.*?)\./i);
  const state = (stateM ? stateM[1] : "").trim();
  return { city, state };
}

const kinds = {};
for (const c of chunks) kinds[c.kind || "unknown"] = (kinds[c.kind || "unknown"] || 0) + 1;
const boostKinds = {};
for (const c of boostRows) boostKinds[c.kind || "unknown"] = (boostKinds[c.kind || "unknown"] || 0) + 1;

const families = listProductFamilies();
const missingPlaybookIs = [];
const crsNoPin = [];
for (const f of families) {
  if (!f.is?.length) {
    crsNoPin.push(f.id);
    continue;
  }
  const missing = f.is.filter((n) => !catalogue.some((c) => titleHasIs(c.title, n)) && !chunks.some((c) => titleHasIs(c.title, n)));
  if (missing.length) missingPlaybookIs.push({ family: f.id, missing });
}

const labs = chunks.filter((c) => c.kind === "lab");
const emptyCityLabs = [];
const stateCounts = {};
for (const c of labs) {
  const { city, state } = parseLabFields(c.body || "");
  if (!city) emptyCityLabs.push(c.title);
  const key = state || "(empty)";
  stateCounts[key] = (stateCounts[key] || 0) + 1;
}

const STATE_GROUPS = [
  {
    label: "Uttar Pradesh vs U.P./UP/U",
    keys: (k) => /^(u\.?p\.?|u|uttar pradesh|utter pradesh)$/i.test(k),
  },
  {
    label: "Madhya Pradesh vs M.P./MP/M",
    keys: (k) => /^(m\.?p\.?|m|madhya pradesh)$/i.test(k),
  },
  {
    label: "West Bengal vs W.B./WB/W",
    keys: (k) => /^(w\.?b\.?|w|west bengal)$/i.test(k),
  },
  {
    label: "Tamil Nadu vs Tamilnadu",
    keys: (k) => /^tamil\s*nadu$|^tamilnadu$/i.test(k),
  },
];

const stateInconsistent = [];
for (const g of STATE_GROUPS) {
  const hit = Object.entries(stateCounts).filter(([k]) => g.keys(k));
  if (hit.length >= 2) stateInconsistent.push({ group: g.label, counts: Object.fromEntries(hit) });
}

const allRows = [
  ...chunks.map((c) => ({ ...c, layer: "chunk" })),
  ...boostRows.map((c) => ({ ...c, layer: "boost" })),
  ...catalogue.map((c) => ({ ...c, layer: "catalogue" })),
];

const unofficial = [];
const genericHomepage = [];
for (const c of allRows) {
  const url = c.url || c.official_url || "";
  if (!url) continue;
  if (/google\.com\/search/i.test(url) || !isOfficialHost(url)) {
    unofficial.push({ layer: c.layer, id: c.id || null, title: c.title, url });
  }
  if (isBareBisHome(url)) {
    genericHomepage.push({ layer: c.layer, id: c.id || null, title: c.title, url });
  }
}

const flags = [];
if (missingPlaybookIs.length) flags.push(`playbook IS missing from catalogue titles (${missingPlaybookIs.length} families)`);
if (emptyCityLabs.length) flags.push(`lab rows with empty City (${emptyCityLabs.length})`);
if (stateInconsistent.length) flags.push(`lab state abbrev vs full-name split (${stateInconsistent.length} groups)`);
if (genericHomepage.length) flags.push(`bare https://www.bis.gov.in homepage URL (${genericHomepage.length}) — FLAG, not fail`);

const knPath = join(root, "data/manakmitra_bis_knowledge.json");
let knowledge = null;
if (existsSync(knPath)) {
  try {
    knowledge = JSON.parse(readFileSync(knPath, "utf8"));
  } catch {
    knowledge = null;
  }
}
const explore = (knowledge && knowledge.explore_bis) || [];
const crsScheme = (knowledge && knowledge.crs_scheme) || [];
const knCrs = (knowledge && knowledge.crs_products) || [];
function compact(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
const packTitleSet = [...chunks, ...boostRows].map((c) => compact(c.title));
const exploreUnused = explore.filter((e) => {
  const t = compact(e.title);
  return t && !packTitleSet.some((p) => p.includes(t.slice(0, 24)) || t.includes((p || "").slice(0, 24)));
});
if (exploreUnused.length) flags.push(`explore_bis titles not in pack (${exploreUnused.length})`);
if (knowledge && !crsScheme.length) flags.push("crs_scheme missing from knowledge JSON");

const report = {
  ok: unofficial.length === 0,
  verified: pack.verified || pack.verifiedAt || null,
  counts: {
    chunks: chunks.length,
    catalogue: catalogue.length,
    boost: boostRows.length,
    byKind: kinds,
    boostByKind: boostKinds,
    process: kinds.process || 0,
    hallmark: kinds.hallmark || 0,
    consumer: kinds.consumer || 0,
    faq: kinds.faq || 0,
    lab: kinds.lab || 0,
  },
  playbook: {
    families: families.length,
    missingPinnedIsTitle: missingPlaybookIs,
    noPinnedIs: crsNoPin,
  },
  labs: {
    total: labs.length,
    emptyCity: emptyCityLabs.length,
    emptyCityTitles: emptyCityLabs,
    stateCounts,
    stateInconsistent,
  },
  unofficialHost: unofficial,
  genericHomepage,
  ingestion: {
    exploreBis: { source: explore.length, unused: exploreUnused.map((e) => e.id || e.title) },
    crsSchemeNotes: crsScheme.length,
    knowledgeCrs: knCrs.length,
    packCrs: kinds.crs || 0,
  },
  flags,
};

console.log(JSON.stringify(report, null, 2));

if (unofficial.length) {
  console.error(`eval:pack FAIL — ${unofficial.length} unofficial SOURCE url(s)`);
  process.exit(1);
}
process.exit(0);
