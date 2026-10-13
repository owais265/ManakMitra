#!/usr/bin/env node
/**
 * Hybrid-only stress: 100 questions through retrieveHybrid.
 * No LLM. Writes artifacts/hybrid-stress-100.json.
 */
import { createJiti } from "jiti";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const warns = [];
const origWarn = console.warn;
console.warn = (...args) => {
  const line = args.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ").slice(0, 400);
  if (/hybrid|embed|rpc|bm25|dense|supabase|pack_docs/i.test(line)) warns.push(line);
  origWarn(...args);
};

const net = { embed: 0, sb: 0, embedFail: 0, sbFail: 0 };
const origFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = typeof input === "string" ? input : input instanceof URL ? String(input) : input?.url || "";
  const isEmbed = u.includes("generativelanguage.googleapis.com");
  const isSb = u.includes("supabase.co");
  if (isEmbed) net.embed++;
  if (isSb) net.sb++;
  try {
    const res = await origFetch(input, init);
    if (isEmbed && !res.ok) net.embedFail++;
    if (isSb && !res.ok) net.sbFail++;
    return res;
  } catch (err) {
    if (isEmbed) net.embedFail++;
    if (isSb) net.sbFail++;
    throw err;
  }
};

const { retrieveHybrid } = jiti(join(root, "src/lib/retrieve.ts"));
const { vectorRetrieve } = jiti(join(root, "src/lib/rag.ts"));
const { listProductFamilies } = jiti(join(root, "src/lib/product-playbook.ts"));
const { isOfficialHost } = jiti(join(root, "src/lib/official-hosts.ts"));

const families = listProductFamilies();
const questions = [];

function add(row) {
  questions.push(row);
}

for (const f of families.slice(0, 40)) {
  const name = f.aliases.find((a) => /^[a-z0-9 ./-]{4,}$/i.test(a)) || f.aliases[0];
  add({
    id: `p-${f.id}`,
    bucket: "product",
    q: `${name} ke liye kaun sa BIS standard hai`,
    expectIs: f.is.slice(0, 4),
  });
}

for (const f of families.slice(0, 15)) {
  const name = f.aliases.find((a) => /^[a-z0-9 ./-]{4,}$/i.test(a)) || f.aliases[0];
  add({
    id: `proc-${f.id}`,
    bucket: "process",
    q: `${name} ka BIS certification process aur fee kya hai`,
    expectIs: f.is.slice(0, 3),
  });
}

const labs = [
  ["raipur-cement", "Raipur mein cement testing laboratory"],
  ["delhi-helmet", "helmet testing laboratory in delhi"],
  ["mumbai-pipe", "pvc pipe lab in mumbai"],
  ["chennai-fan", "ceiling fan laboratory in chennai"],
  ["kolkata-water", "packaged drinking water lab in kolkata"],
  ["pune-tyre", "tyre testing lab in pune"],
  ["jaipur-gold", "hallmark assaying centre in jaipur"],
  ["indore-steel", "steel testing laboratory in indore"],
  ["bhopal-cable", "cable lab in bhopal"],
  ["nagpur-cement", "Nagpur cement laboratory list"],
  ["bhilai-rebar", "TMT bar lab in bhilai"],
  ["hyderabad-led", "LED lamp testing lab in hyderabad"],
];
for (const [id, q] of labs) add({ id: `lab-${id}`, bucket: "lab", q, city: q.match(/raipur|delhi|mumbai|chennai|kolkata|pune|jaipur|indore|bhopal|nagpur|bhilai|hyderabad/i)?.[0] });

const typed = [
  ["is-269", "IS 269 ordinary portland cement requirements", "269"],
  ["is-694", "IS 694 PVC insulated cable", "694"],
  ["is-302", "IS 302 safety of household appliances", "302"],
  ["is-1417", "IS 1417 gold jewellery hallmark fineness", "1417"],
  ["is-13252", "IS 13252 laptop adapter safety", "13252"],
  ["is-4984", "IS 4984 polyethylene pipes for water", "4984"],
  ["is-2925", "IS 2925 industrial safety helmet", "2925"],
  ["is-14543", "IS 14543 packaged drinking water", "14543"],
  ["is-4246", "IS 4246 domestic gas stove", "4246"],
  ["is-15644", "IS 15644 safety of electric toys? wait household switches IS 3854", "3854"],
];
for (const [id, q, n] of typed) add({ id, bucket: "typed-is", q, expectIs: [n], typed: n });

const hindi = [
  ["hi-cement", "सीमेंट के लिए कौन सा आईएस है", ["269"]],
  ["hi-helmet", "हेलमेट का मानक क्या है", ["2925", "4151"]],
  ["hi-gold", "सोने के गहनों पर हॉलमार्क और ह्यूइड कैसे चेक करें", ["1417"]],
  ["hi-water", "बोतल बंद पानी का बीआईएस मानक", ["14543", "13428"]],
  ["hi-complaint", "बीआईएस शिकायत कहाँ दर्ज करें", []],
  ["hi-pipe", "पीवीसी पाइप का मानक बताओ", ["4985", "12818", "13592"]],
  ["hi-lab", "रायपुर में सीमेंट की प्रयोगशाला", []],
  ["hi-mixer", "मिक्सर ग्राइंडर की आईएसआई", ["302", "4250"]],
];
for (const [id, q, expectIs] of hindi) add({ id, bucket: "hindi", q, expectIs });

const weak = [
  ["w-fmcs", "foreign manufacturer certification scheme FMCS documents required for BIS"],
  ["w-club", "how to start a BIS standards club in a school"],
  ["w-inhouse", "in-house laboratory recognition circular December 2025 BIS"],
  ["w-foil", "IS 16011 aluminium foil for pharmaceutical packaging"],
  ["w-keyboard", "compulsory registration for wireless keyboard and mouse"],
  ["w-pump", "centrifugal pump product manual sampling and test schedule BIS"],
  ["w-renew", "manakonline ISI licence renewal steps and fee"],
  ["w-toys", "toys under compulsory BIS certification which IS applies"],
];
for (const [id, q] of weak) add({ id, bucket: "weak", q, expectIs: id === "w-foil" ? ["16011"] : id === "w-toys" ? ["9873", "15644"] : [] });

const edges = [
  ["e-empty", ""],
  ["e-space", "   "],
  ["e-is", "IS"],
  ["e-sql", "'; select * from pack_docs; -- cement"],
  ["e-long", `${"cement BIS standard ".repeat(80)}`.slice(0, 1800)],
  ["e-off", "IPL winner 2026 kaun tha"],
  ["e-shimla", "helmet laboratory in shimla"],
];
for (const [id, q] of edges) add({ id, bucket: "edge", q });

if (questions.length !== 100) {
  console.error("expected 100 questions, got", questions.length);
  process.exit(1);
}

function titles(r) {
  return (r?.hits || []).slice(0, 5).map((h) => h.title);
}

function blob(r) {
  return (r?.hits || []).map((h) => `${h.title} ${h.body}`).join("\n");
}

function hasIs(r, ids) {
  if (!ids?.length) return null;
  const text = blob(r);
  return ids.some((n) => new RegExp(`(?:IS\\s*)?${n}\\b`, "i").test(text));
}

const rows = [];
let fail = 0;

for (let i = 0; i < questions.length; i++) {
  const item = questions[i];
  const beforeW = warns.length;
  const beforeNet = { ...net };
  const t0 = Date.now();
  let local = null;
  let hybrid = null;
  let error = null;
  try {
    local = vectorRetrieve(item.q);
    hybrid = await Promise.race([
      retrieveHybrid(item.q),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout-25s")), 25_000)),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const ms = Date.now() - t0;
  const hits = hybrid?.hits || [];
  const issues = [];
  if (error) issues.push(`throw:${error}`);
  if (ms >= 25_000) issues.push("slow");
  for (const h of hits) {
    if (!h.title) issues.push("empty-title");
    if (!Number.isFinite(h.score)) issues.push("bad-score");
    if (!h.url || !isOfficialHost(h.url)) issues.push(`unofficial:${h.url || "missing"}`);
  }
  const titlesSeen = new Set();
  for (const h of hits) {
    if (titlesSeen.has(h.title)) issues.push(`dup:${h.title.slice(0, 60)}`);
    titlesSeen.add(h.title);
  }
  if (local?.hasEvidence && hybrid && !hybrid.hasEvidence) issues.push("wiped-evidence");
  if (item.typed && hybrid?.hasEvidence) {
    const top = (hybrid.hits[0]?.title || "") + " " + (hybrid.hits[0]?.body || "");
    if (!new RegExp(`(?:^|\\D)${item.typed}(?:\\D|$)`).test(top) && !blob(hybrid).includes(item.typed)) {
      issues.push("typed-is-missing");
    }
  }
  if (item.bucket === "lab" || item.id === "e-shimla") {
    const city = (item.city || (item.id === "e-shimla" ? "shimla" : "")).toLowerCase();
    const labHits = hits.filter((h) => h.kind === "lab");
    const mentions = (h) => {
      const blob = `${h.title} ${h.body}`.replace(/contact_person:\s*[^|\n]*/gi, " ");
      return new RegExp(`(?:^|[^a-z])${city}(?:[^a-z]|$)`, "i").test(blob);
    };
    if (labHits.length && city && !labHits.some(mentions)) issues.push("lab-city-mismatch");
    if (item.id === "e-shimla" && labHits.some((h) => /jaipur/i.test(h.title))) issues.push("shimla-jaipur-false-hit");
  }
  if (item.expectIs?.length && item.bucket === "product" && hybrid && !hasIs(hybrid, item.expectIs) && local && hasIs(local, item.expectIs)) {
    issues.push("lost-expected-is");
  }
  const qWarns = warns.slice(beforeW);
  if (qWarns.length) issues.push(`warn:${qWarns.length}`);
  const delta = {
    embed: net.embed - beforeNet.embed,
    sb: net.sb - beforeNet.sb,
    embedFail: net.embedFail - beforeNet.embedFail,
    sbFail: net.sbFail - beforeNet.sbFail,
  };
  if (delta.sbFail) issues.push(`sb-http-fail:${delta.sbFail}`);
  if (delta.embedFail) issues.push(`embed-fail:${delta.embedFail}`);
  const hard = issues.filter((x) => !x.startsWith("warn:"));
  if (hard.length) fail++;
  const row = {
    i: i + 1,
    id: item.id,
    bucket: item.bucket,
    q: item.q.slice(0, 140),
    ms,
    error,
    issues,
    localTop: local?.hits?.[0] ? `${local.hits[0].score} ${local.hits[0].title}` : null,
    localN: local?.hits?.length || 0,
    localConf: local?.confidence || null,
    hybridN: hits.length,
    hybridConf: hybrid?.confidence || null,
    grounding: hybrid?.grounding || null,
    top: titles(hybrid),
    lanes: hits.map((h) => h.lane || h.kind).slice(0, 5),
    delta,
    warns: qWarns.slice(0, 3),
  };
  rows.push(row);
  const mark = hard.length ? "FAIL" : "ok";
  console.log(
    `${String(i + 1).padStart(3)} ${mark} ${item.id} ${ms}ms hits=${hits.length} ${hard.join(",") || "-"} | ${(titles(hybrid)[0] || "").slice(0, 70)}`,
  );
}

const byBucket = {};
for (const r of rows) {
  byBucket[r.bucket] = byBucket[r.bucket] || { n: 0, fail: 0, ms: 0 };
  byBucket[r.bucket].n++;
  byBucket[r.bucket].ms += r.ms;
  if (r.issues.some((x) => !x.startsWith("warn:"))) byBucket[r.bucket].fail++;
}

const summary = {
  at: new Date().toISOString(),
  n: rows.length,
  fail,
  net,
  warnCount: warns.length,
  byBucket,
  p95ms: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length * 0.95)] || 0,
  failures: rows.filter((r) => r.issues.some((x) => !x.startsWith("warn:"))),
};
writeFileSync(join(root, "artifacts/hybrid-stress-100.json"), JSON.stringify({ summary, rows }, null, 2));
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
process.exit(fail ? 2 : 0);
