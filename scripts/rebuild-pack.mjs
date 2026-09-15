#!/usr/bin/env node
/**
 * SAFE pack operator path — stamp verified date + validate.
 * Does NOT scrape BIS, does NOT merge unknown dumps, does NOT rebuild TF-IDF.
 * Optional full rebuild remains: python scripts/build_rag_index.py (sklearn).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packPath = join(root, "src/data/rag-pack.json");
const boostPath = join(root, "src/data/verified-boost.json");
const metaPath = join(root, "src/data/pack-meta.json");

const ALLOWED_EXTRA = new Set([
  "rag-pack.json",
  "verified-boost.json",
  "bis-index.json",
  "pack-meta.json",
  "01_standards.csv",
  "02_product_requirements.csv",
  "03_certification_process.csv",
  "04_testing_labs.csv",
  "05_hallmarking.csv",
  "06_crs_products.csv",
  "07_consumer_support.csv",
  "08_faqs.csv",
  "09_official_links.csv",
  "10_documents_metadata.csv",
  "manakmitra_bis_knowledge.json",
  "recognised-laboratories.json",
  "bis_chatbot_knowledge_base.json",
]);

const BLOCKED = /bis_knowledge_base_large|manakmitra_bis_knowledge_10k|synthetic/i;

const extra = process.argv.slice(2).filter((a) => !a.startsWith("-"));
for (const a of extra) {
  const name = basename(a);
  if (BLOCKED.test(name) || BLOCKED.test(a)) {
    console.error(`refusing unknown/synthetic dump: ${a}`);
    process.exit(1);
  }
  if (!ALLOWED_EXTRA.has(name)) {
    console.error(`refusing extra file (not in authorised source list): ${a}`);
    process.exit(1);
  }
}

function mustJson(path, label) {
  if (!existsSync(path)) {
    console.error(`missing ${label}: ${path}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`${label} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  return data;
}

const pack = mustJson(packPath, "rag-pack");
const boost = mustJson(boostPath, "verified-boost");

if (!Array.isArray(pack.vocab) || !Array.isArray(pack.idf) || !Array.isArray(pack.docs) || !Array.isArray(pack.chunks)) {
  console.error("rag-pack.json missing vocab/idf/docs/chunks");
  process.exit(1);
}

const chunks = pack.chunks;
const catalogue = pack.catalogue || [];
const fake = [];
for (const ch of [...chunks, ...catalogue, ...(Array.isArray(boost) ? boost : [])]) {
  const blob = `${ch.title || ""} ${ch.body || ""}`;
  if (/accredited for IS\s*\d+/i.test(blob) || /accredited to test IS\s*\d+/i.test(blob)) {
    fake.push(ch.title || ch.id);
  }
}
if (fake.length) {
  console.error("hygiene fail — IS-specific lab accreditation claims:", fake.slice(0, 8));
  process.exit(1);
}

const CITIES =
  /\b(new delhi|navi mumbai|greater noida|raipur|mumbai|delhi|chennai|kolkata|hyderabad|bengaluru|bangalore|bengulur|pune|ahmedabad|ahemdabad|ahmadabad|lucknow|jaipur|nagpur|nashik|nasik|bhopal|indore|surat|kanpur|patna|chandigarh|guwahati|howrah|dhanbad|faridabad|ghaziabad|ludhiana|meerut|ranchi|jodhpur|gwalior|kota|madurai|vadodara|bhubaneswar|amritsar|agra|varanasi|rajkot|thane|noida|ranipet|isnapur|gurgaon|gurugram|mohali|sonepat|sonipat|bahadurgarh|panchkula|coimbatore|dehradun|gandhinagar|mysuru|mysore|jalandhar|haridwar|kochi|cochin|aurangabad|vijayawada|visakhapatnam|vishakhapatnam)\b/i;

function cityFromTitle(title) {
  const t = title || "";
  let last = "";
  const re = new RegExp(CITIES.source, "gi");
  let m;
  while ((m = re.exec(t))) last = m[0];
  if (last) {
    if (/north\s+delhi/i.test(t) && /delhi/i.test(last)) return "North Delhi";
    return last;
  }
  return "";
}

function expandState(body) {
  return (body || "")
    .replace(/\bU\.P\.?/g, "Uttar Pradesh")
    .replace(/\bM\.P\.?/g, "Madhya Pradesh")
    .replace(/\bW\.B\.?/g, "West Bengal")
    .replace(/\bA\.P\.?/g, "Andhra Pradesh")
    .replace(/\bH\.P\.?/g, "Himachal Pradesh")
    .replace(/\bTamilnadu\b/gi, "Tamil Nadu")
    .replace(/\bKarnatka\b/gi, "Karnataka")
    .replace(/\bUtter Pradesh\b/gi, "Uttar Pradesh")
    .replace(/\bUttrakhand\b/gi, "Uttarakhand")
    .replace(/\bHarayana\b/gi, "Haryana")
    .replace(/\bMaharshtra\b/gi, "Maharashtra")
    .replace(/\bState UP\b/g, "State Uttar Pradesh")
    .replace(/\bState MP\b/g, "State Madhya Pradesh")
    .replace(/\bState AP\b/g, "State Andhra Pradesh")
    .replace(/\bState WB\b/g, "State West Bengal");
}

let labFilled = 0;
for (const ch of chunks) {
  if (ch.kind !== "lab") continue;
  let body = ch.body || "";
  const cityM = body.match(/City\s+(.*?)\.\s*State/i);
  const city = (cityM ? cityM[1] : "").trim();
  if (!city) {
    const parsed = cityFromTitle(ch.title || "");
    if (parsed) {
      if (/City\s+\./i.test(body)) body = body.replace(/City\s+\./i, `City ${parsed}.`);
      else if (/\bState\s+/i.test(body)) body = body.replace(/\bState\s+/i, `City ${parsed}. State `);
      else body = `${body} City ${parsed}.`;
      labFilled += 1;
    }
  }
  ch.body = expandState(body);
}

let validityRewritten = 0;
for (const ch of chunks) {
  const blob = `${ch.title || ""} ${ch.body || ""}`;
  if (/normally 1 saal/i.test(blob) && /valid/i.test(blob)) {
    ch.body =
      "Certification under Scheme-I may initially be granted for up to two years, valid only for the varieties mentioned in the licence, and may be renewed for up to five years from the last date of validity on application with the requisite fee and documents. Re-check the live BIS product-certification FAQ. This is not a 3-year-only or 1-year-only licence.";
    ch.url = "https://www.bis.gov.in/product-certification/product-certification-faq/?lang=en";
    validityRewritten += 1;
  }
}

const HOME_RETARGET = [
  {
    match: /fmcs foreign manufacturers certification scheme/i,
    url: "https://www.bis.gov.in/fmcs/certification-process/aboutfmcs/?lang=en",
  },
  {
    match: /bis care app consumer verification/i,
    url: "https://www.bis.gov.in/bis-apps/?lang=en",
  },
  {
    match: /common is\/iso management system standards/i,
    url: "https://www.bis.gov.in/product-certification/product-certification-overview/?lang=en",
  },
  {
    match: /an iso certificate is not an isi or crs licence/i,
    url: "https://www.bis.gov.in/product-certification/product-certification-overview/?lang=en",
  },
];
let homepageRetargeted = 0;
for (const ch of chunks) {
  if (!/^https:\/\/www\.bis\.gov\.in\/?$/i.test(ch.url || "")) continue;
  const hit = HOME_RETARGET.find((r) => r.match.test(ch.title || ""));
  if (hit) {
    ch.url = hit.url;
    homepageRetargeted += 1;
  }
}

const iso = new Date().toISOString().slice(0, 10);
pack.verified = iso;
pack.verifiedAt = iso;
writeFileSync(packPath, JSON.stringify(pack));
writeFileSync(
  metaPath,
  `${JSON.stringify(
    {
      verified: iso,
      verifiedAt: iso,
      chunks: chunks.length,
      catalogue: catalogue.length,
      boost: Array.isArray(boost) ? boost.length : 0,
      labCityFilledFromTitle: labFilled,
      validityRewritten,
      homepageRetargeted,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "stamp-validate",
      verifiedAt: iso,
      chunks: chunks.length,
      catalogue: catalogue.length,
      boost: Array.isArray(boost) ? boost.length : 0,
      labCityFilledFromTitle: labFilled,
      validityRewritten,
      homepageRetargeted,
      note: "Did not rebuild TF-IDF. Full rebuild: python scripts/build_rag_index.py",
    },
    null,
    2,
  ),
);
