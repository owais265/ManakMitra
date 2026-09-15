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

const { retrieve, groundedFallback, JEWELLER_STEP_FORBID } = jiti(join(root, "src/lib/retrieve.ts"));
const { classifyIntent, socialReply } = jiti(join(root, "src/lib/intent.ts"));
const { rewriteQueryDebug, isFollowCue } = jiti(join(root, "src/lib/query-context.ts"));
const { matchProductFamily, shouldClarify } = jiti(join(root, "src/lib/product-playbook.ts"));
const { APP_LANGS, UI_DICTIONARY, FALLBACK_SHELL } = jiti(join(root, "src/lib/language.ts"));

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
    query: "cement process aur fee batao",
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
    fallbackRequire: /crsbis\.in/i,
    hasEvidence: true,
  },
  {
    id: "raipur-lab",
    query: "Raipur mein cement test lab",
    expectIntent: "bis",
    requireBlob: /raipur/i,
    labOk: true,
    fallbackForbid: /accredited for IS 269/i,
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
  {
    id: "pvc-pipe",
    query: "PVC Pipes ke liye kaunsa BIS standard",
    expectIntent: "bis",
    family: "pvc-pipe",
    requireTitle: /IS 4985\b/,
    hasEvidence: true,
  },
  {
    id: "gold-916",
    query: "What does 916 gold mean in BIS?",
    expectIntent: "bis",
    family: "gold",
    requireTitle: /1417|1418/,
    requireAny: /916|hallmark|HUID|CARE/i,
    forbid: /IS 916\s*:|IS 2790/,
    hasEvidence: true,
  },
  {
    id: "care-app",
    query: "How to use BIS CARE app?",
    expectIntent: "bis",
    requireTop1: /CARE/i,
    requireBlob: /CARE|HUID|complaint/i,
    requireAny: /CARE/i,
    forbid: /IS 18243|IS 302 : Part 2 : Sec 23/,
    fallbackForbid: /Apply online as jeweller|Sell only AHC-hallmarked|Submit with no docs\/fee|Get instant registration/i,
    hasEvidence: true,
  },
  {
    id: "pvc-pipe-fees",
    query: "PVC Pipes fees and process",
    expectIntent: "bis",
    family: "pvc-pipe",
    requireTitle: /IS 4985\b/,
    hasEvidence: true,
  },
  {
    id: "training-strict",
    query: "BIS training workshop standards club",
    expectIntent: "bis",
    requireTop1: /enquiry|training|directory|contact|club/i,
    requireAny: /enquiry|training|directory|contact/i,
    requireBlob: /enquiry|training|directory|contact|workshop|club/i,
    forbidRest: /what is bis/i,
    hasEvidence: true,
  },
  {
    id: "hey-social",
    query: "hey",
    expectIntent: "social",
  },
  {
    id: "hi-social",
    query: "hi",
    expectIntent: "social",
  },
  {
    id: "who-won-ipl",
    query: "who won IPL",
    expectIntent: "offtopic",
    hasEvidence: false,
  },
  {
    id: "isi-apply",
    query: "how to apply for ISI mark",
    expectIntent: "bis",
    requireAny: /scheme-i|isi mark|product certification|manakonline/i,
    fallbackRequire: /https:\/\/www\.manakonline\.in/i,
    fallbackForbid: /([^a-z]|^)akonline\.in/i,
    hasEvidence: true,
  },
  {
    id: "hallmark-vague",
    query: "hallmark",
    expectIntent: "bis",
    clarify: true,
    forbid: /IS 916\s*:/,
    fallbackForbid: JEWELLER_STEP_FORBID,
    fallbackNoProcess: true,
    hasEvidence: true,
  },
  {
    id: "verify-huid",
    query: "verify HUID",
    expectIntent: "bis",
    family: "gold",
    fallbackForbid: /Apply online as jeweller|Sell only AHC-hallmarked|Submit with no docs\/fee|Get instant registration/i,
    fallbackRequire: /CARE|Verify HUID/i,
    hasEvidence: true,
  },
  {
    id: "bis-care-app",
    query: "BIS CARE app",
    expectIntent: "bis",
    fallbackForbid: /Apply online as jeweller|Sell only AHC-hallmarked|Submit with no docs\/fee|Get instant registration/i,
    fallbackRequire: /CARE|HUID/i,
    hasEvidence: true,
  },
  {
    id: "cement-fees-cue",
    query: "cement fees?",
    expectIntent: "bis",
    family: "cement",
    followCue: false,
    requireTitle: /IS 269\b/,
    hasEvidence: true,
  },
  {
    id: "pvc-pipe-lab",
    query: "PVC pipe lab",
    expectIntent: "bis",
    family: "pvc-pipe",
    followCue: false,
    requireTitle: /IS 4985\b/,
    forbid: /IS 302|IS 18243|IS 694\b/,
    hasEvidence: true,
  },
  {
    id: "gold-916-process",
    query: "916 gold hallmark process",
    expectIntent: "bis",
    family: "gold",
    followCue: false,
    requireTitle: /1417|1418/,
    requireAny: /916|hallmark|HUID|CARE/i,
    forbid: /IS 916\s*:|IS 2790/,
    hasEvidence: true,
  },
  {
    id: "cement-related",
    query: "cement related standards",
    expectIntent: "bis",
    family: "cement",
    followCue: false,
    requireAny: /269|portland|8041|1489|cement/i,
    forbid: /IS 1417|CARE app|gold jewellery/i,
    hasEvidence: true,
  },
  {
    id: "who-are-you-fees",
    query: "fees?",
    expectIntent: "social",
    followCue: true,
    rewriteForbid: /269/,
    hasEvidence: false,
  },
  {
    id: "gold-then-cement",
    query: "what about cement",
    expectIntent: "bis",
    family: "cement",
    switchedFamily: "cement",
    followCue: false,
    requireTop1: /IS 269\b/,
    forbid: /IS 1417|IS 1418/,
    hasEvidence: true,
  },
  {
    id: "who-won-the-match",
    query: "who won the match",
    expectIntent: "offtopic",
    hasEvidence: false,
  },
  {
    id: "cement-fees-amount",
    query: "cement ke liye fees",
    expectIntent: "bis",
    family: "cement",
    requireTitle: /IS 269\b/,
    requireBlob: /Rs\.?\s*1,?000|application fee/i,
    hasEvidence: true,
  },
  {
    id: "simplified-option2",
    query: "simplified procedure option 2",
    expectIntent: "bis",
    requireTop1: /option|simplified|timeline|licence|manak|test report/i,
    requireAny: /option-?2|simplified|90 days|one month/i,
    forbid: /IS 8504/,
    hasEvidence: true,
  },
  {
    id: "hq-address",
    query: "BIS head office address",
    expectIntent: "bis",
    requireBlob: /Manak Bhawan|Bahadur Shah|110002/i,
    forbid: /IS 18750|IS 19341/,
    hasEvidence: true,
  },
  {
    id: "crs-rnumber",
    query: "CRS R-number verify",
    expectIntent: "bis",
    fallbackForbid: /Tap Verify HUID|Enter the 6-digit HUID|Apply online as jeweller/i,
    fallbackRequire: /crs|R-?number|crsbis/i,
    hasEvidence: true,
  },
  {
    id: "toys-is",
    query: "toys ke liye BIS standard",
    expectIntent: "bis",
    family: "toys",
    requireAny: /9873|15644/,
    hasEvidence: true,
  },
  {
    id: "fmcs-air",
    query: "FMCS AIR kaise nominate",
    expectIntent: "bis",
    requireAny: /AIR|Authorised Indian Representative|FMCS/i,
    fallbackRequire: /manakonline\.in|fmcs/i,
    hasEvidence: true,
  },
  {
    id: "utensils-ss",
    query: "What standard covers stainless steel sheets used for utensils?",
    expectIntent: "bis",
    family: "stainless-utensils",
    requireTitle: /IS 5522\b/,
    forbid: /IS 14756|IS 7397/,
    hasEvidence: true,
  },
  {
    id: "messy-5522",
    query: "5522 2014",
    expectIntent: "bis",
    requireTitle: /IS 5522\b/,
    hasEvidence: true,
  },
  {
    id: "indian-standard-269",
    query: "Indian Standard 269",
    expectIntent: "bis",
    requireTitle: /IS 269\b/,
    hasEvidence: true,
  },
  {
    id: "geyser",
    query: "electric geyser BIS standard",
    expectIntent: "bis",
    family: "geyser",
    requireTitle: /IS 2082\b/,
    hasEvidence: true,
  },
  {
    id: "packaged-water",
    query: "packaged drinking water BIS standard",
    expectIntent: "bis",
    family: "packaged-water",
    requireAny: /15609|14543|Know Your Standard/i,
    forbid: /^IS\s*14543\b/,
    hasEvidence: true,
  },
  {
    id: "power-bank-crs",
    query: "power bank BIS",
    expectIntent: "bis",
    family: "power-bank",
    requireAny: /power bank/i,
    fallbackRequire: /crsbis\.in/i,
    hasEvidence: true,
  },
  {
    id: "printer-crs",
    query: "printers plotters CRS",
    expectIntent: "bis",
    family: "printer",
    requireAny: /printer|plotter/i,
    fallbackRequire: /crsbis\.in/i,
    hasEvidence: true,
  },
  {
    id: "is-iso-isi",
    query: "IS, ISO, aur ISI Mark mein kya difference hae?",
    expectIntent: "bis",
    requireAny: /ISO|IEC|ISI Mark|national standards/i,
    forbid: /IS 916\s*:/,
    hasEvidence: true,
  },
  {
    id: "led-is",
    query: "LED bulbs ke liye kaun sa Indian Standard",
    expectIntent: "bis",
    family: "led",
    requireAny: /16102|16107/,
    hasEvidence: true,
  },
  {
    id: "esale",
    query: "Mujhe ek specific Indian Standard ka full document download karna hae",
    expectIntent: "bis",
    requireAny: /e-Sale|esale|Know Your Standard|standardsbis/i,
    forbid: /IS 14543\s*:/,
    hasEvidence: true,
  },
  {
    id: "licence-validity",
    query: "ISI license kitne din valid hota hae? Renewal process kya hae?",
    expectIntent: "bis",
    requireBlob: /two years|2 years|five years|5 years/i,
    forbid: /IS 4151/,
    hasEvidence: true,
  },
  {
    id: "agmark-not-bis",
    query: "Agmark BIS scheme hai kya?",
    expectIntent: "bis",
    requireBlob: /not a BIS/i,
    forbid: /IS 7397|IS 4151/,
    hasEvidence: true,
  },
  {
    id: "bee-not-isi",
    query: "5 star fridge BEE label ISI mark hai kya?",
    expectIntent: "bis",
    requireBlob: /BEE star|not the ISI|not CRS/i,
    hasEvidence: true,
  },
  {
    id: "what-are-is",
    query: "What are Indian Standards?",
    expectIntent: "bis",
    requireAny: /What are Indian Standards|What is BIS|National Standards Body/i,
    forbid: /IS 17041/,
    hasEvidence: true,
  },
  {
    id: "drinking-water-10500",
    query: "Which standard applies to drinking water?",
    expectIntent: "bis",
    family: "drinking-water",
    requireTitle: /IS 10500\b/,
    forbid: /IS 14543/,
    hasEvidence: true,
  },
  {
    id: "lab-directory-not-random",
    query: "How to find a BIS accredited laboratory?",
    expectIntent: "bis",
    requireAny: /LIMS|recognised laborator|testing laboratory directory/i,
    forbid: /PRESTO LABORATORIES/,
    hasEvidence: true,
  },
  {
    id: "contact-bis",
    query: "How to contact BIS for queries?",
    expectIntent: "bis",
    requireAny: /Manak Bhawan|enquiry directory|110002/i,
    forbid: /SP 7\b/,
    hasEvidence: true,
  },
  {
    id: "agmark-food-no-scheme-word",
    query: "What is Agmark for food products?",
    expectIntent: "bis",
    requireBlob: /not a BIS/i,
    hasEvidence: true,
  },
  {
    id: "msme-not-language-crs",
    query: "What support does BIS provide to MSMEs?",
    expectIntent: "bis",
    requireAny: /MSME|manakonline|enquiry/i,
    forbid: /Indian Language Support/,
    hasEvidence: true,
  },
  {
    id: "isi-cost-not-price-range",
    query: "What is the cost of ISI certification?",
    expectIntent: "bis",
    requireBlob: /Rs\.?\s*1,?000|application fee/i,
    forbid: /IS\/IEC 61400/,
    hasEvidence: true,
  },
  {
    id: "help-consumers-not-social",
    query: "How standards help consumers?",
    expectIntent: "bis",
    requireAny: /consumer|complaint|CARE|What is BIS|Indian Standards/i,
    hasEvidence: true,
  },
  {
    id: "electric-kettle-367",
    query: "What are the safety requirements for electric kettles?",
    expectIntent: "bis",
    family: "electric-kettle",
    requireTitle: /IS 367\b/,
    forbid: /IS 12047/,
    hasEvidence: true,
  },
  {
    id: "paint-not-383",
    query: "Which standard applies to paint/coatings?",
    expectIntent: "bis",
    requireBlob: /IS 383.*aggregate|do not use IS 383|Know Your Standard/i,
    forbid: /^IS\s*383\b/,
    hasEvidence: true,
  },
  {
    id: "unknown-is-1234",
    query: "IS 1234 revised hua aur previous version se 40% content change hua. Transition period kya hona chahiye?",
    expectIntent: "bis",
    requireAny: /not in this catalogue|Know Your Standard|pack has no SOP/i,
    forbid: /IS 406\b/,
    hasEvidence: true,
  },
  {
    id: "enforcement-not-cement",
    query: "Ek category mein 50% manufacturers unlicensed products bech rahe hain. Enforcement resources unlimited nahi.",
    expectIntent: "bis",
    requireAny: /complaint|unlicensed|QCO|compulsory|Know Your Standard|pack has no SOP|enquiry/i,
    forbid: /IS 269\b/,
    hasEvidence: true,
  },
  {
    id: "hinglish-hi-not-social",
    query: "Ek product design hi hazardous nikla (not manufacturing fault). Manufacturing non-compliance kaise alag karun?",
    expectIntent: "bis",
    hasEvidence: true,
  },
  {
    id: "digital-twin-not-xr",
    query: "Digital twin (virtual simulation) replaces physical testing. Can virtual test results replace real-world testing for certification?",
    expectIntent: "bis",
    requireAny: /pack has no SOP|Know Your Standard|enquiry|manakonline/i,
    forbid: /Extended Reality|Smart Speakers/i,
    hasEvidence: true,
  },
  {
    id: "firmware-not-speakers",
    query: "Smart product IoT firmware update ke baad kya certification still valid hae?",
    expectIntent: "bis",
    requireAny: /pack has no SOP|Know Your Standard|enquiry|CRS|crsbis/i,
    forbid: /Smart Speakers/i,
    hasEvidence: true,
  },
  {
    id: "huid-msme-not-scheme-i",
    query: "huid check karo 22k chain raipur shop MSME",
    expectIntent: "bis",
    family: "gold",
    requireTop1: /HUID|CARE|22 Carat|916/i,
    forbid: /same Scheme-I \/ CRS|IS 269\b/i,
    hasEvidence: true,
  },
  {
    id: "ahc-not-lims",
    query: "AHC kya hota hai aur MSME ko khud AHC banana padega kya",
    expectIntent: "bis",
    requireAny: /Assaying|Hallmarking Centre|HUID|hallmark/i,
    forbid: /Testing laboratory directory|Group-1/i,
    hasEvidence: true,
  },
  {
    id: "jeweller-ahc-intent",
    query: "AHC ne galat purity mark laga diya, jeweller zimmedar hai kya",
    expectIntent: "bis",
    family: "gold",
    hasEvidence: true,
  },
  {
    id: "halllmarking-fee-not-scheme-i",
    query: "22k halllmarking fee MSME ke liye kam hai kya",
    expectIntent: "bis",
    requireAny: /assay charges|Hallmarking|HUID|CARE|re-check live/i,
    forbid: /same Scheme-I \/ CRS/i,
    hasEvidence: true,
  },
  {
    id: "huid-on-cement-not-verify",
    query: "How can I verify a HUID license number printed on a cement?",
    expectIntent: "bis",
    requireTop1: /only to jewellery|Hallmark \/ HUID applies/i,
    forbid: /How can a consumer verify a HUID|Gold 22 Carat/i,
    hasEvidence: true,
  },
  {
    id: "hallmark-on-water-not-huid",
    query: "Is Hallmark mandatory for buying mineral water in India?",
    expectIntent: "bis",
    requireAny: /only to jewellery|Hallmark \/ HUID applies/i,
    forbid: /How can a consumer verify a HUID/i,
    hasEvidence: true,
  },
  {
    id: "head-of-huid-not-verify",
    query: "Who is the head of HUID in Delhi branch?",
    expectIntent: "bis",
    requireAny: /Officer \/ branch-head names are not in this pack|enquiry|Manak Bhawan/i,
    forbid: /How can a consumer verify a HUID/i,
    hasEvidence: true,
  },
  {
    id: "dump-is-455-not-transformer",
    query: "What is the sampling guideline for testing transformers (IS 455) at the factory level?",
    expectIntent: "bis",
    requireTop1: /do not mix catalogue rows|pack has no SOP|Know Your Standard/i,
    hasEvidence: true,
  },
  {
    id: "manakonline-intent",
    query: "How to download the Manakonline on my mobile?",
    expectIntent: "bis",
    requireAny: /manakonline|Scheme-I|MANAK/i,
    hasEvidence: true,
  },
  {
    id: "air-fmcs",
    query: "What is the role of an Authorized Indian Representative (AIR) for UK manufacturers?",
    expectIntent: "bis",
    requireAny: /FMCS|Authorised Indian Representative|Authorized Indian Representative|imported/i,
    hasEvidence: true,
  },
  {
    id: "section-stop-sale-not-empty",
    query: "Explain the jurisprudence behind issuing a stop-sale order on BIS Care App for pressure cookers under Section 16.",
    expectIntent: "bis",
    requireAny: /Stop marking|stop-sale|pack has no SOP|penalt|complaint/i,
    hasEvidence: true,
  },
  {
    id: "huid-mandatory-helmets",
    query: "Is it absolutely mandatory to have HUID code on motorcycle helmets in the Indian market?",
    expectIntent: "bis",
    requireTop1: /Hallmark \/ HUID applies only to jewellery/i,
    hasEvidence: true,
  },
  {
    id: "nws-cert-apply",
    query: "As an MSMEs in Thiruvananthapuram, how do I apply for NWS certification for regulators?",
    expectIntent: "bis",
    requireAny: /unknown portal|pack has no SOP|Know Your Standard/i,
    hasEvidence: true,
  },
  {
    id: "ecommerce-section-liability",
    query: "Analyze the liability of an e-commerce platform in Panipat selling uncertified scanners under Section 19.",
    expectIntent: "bis",
    requireAny: /Stop marking|penalt|pack has no SOP|complaint/i,
    hasEvidence: true,
  },
  {
    id: "which-clause-of-is-no-dump",
    query: "Which clause of IS 1005 defines the test method for impact resistance?",
    expectIntent: "bis",
    requireAny: /pack has no SOP|Know Your Standard|do not mix|not in this catalogue/i,
    hasEvidence: true,
  },
];

const rows = [];
let failed = 0;

for (const c of cases) {
  const intent = classifyIntent(c.query, c.history);
  const dbg = rewriteQueryDebug(c.query, c.history);
  const rq = dbg.rewritten;
  const family = matchProductFamily(rq) || matchProductFamily(c.query);
  let r = { hits: [], hasEvidence: false };
  if (intent === "bis") r = retrieve(rq);

  const titles = topTitles(r.hits);
  const text = blob(r.hits);
  const reasons = [];

  if (c.expectIntent && intent !== c.expectIntent) reasons.push(`intent ${intent} != ${c.expectIntent}`);
  if (c.family && family?.id !== c.family) reasons.push(`family ${family?.id || "none"} != ${c.family}`);
  if (c.hasEvidence === true && !r.hasEvidence) reasons.push("expected evidence");
  if (c.hasEvidence === false && r.hasEvidence && intent !== "offtopic" && intent !== "social")
    reasons.push("unexpected evidence");
  if (c.expectIntent === "offtopic" && r.hasEvidence) reasons.push("offtopic must not retrieve");
  if (c.expectIntent === "social" && r.hasEvidence) reasons.push("social must not retrieve");
  if (c.requireTitle && !titles.some((t) => c.requireTitle.test(t)))
    reasons.push(`top titles miss ${c.requireTitle}: ${titles.join(" | ")}`);
  if (c.requireTop1 && !c.requireTop1.test(titles[0] || ""))
    reasons.push(`top-1 miss ${c.requireTop1}: ${titles[0] || "(empty)"}`);
  if (c.forbidRest && titles.slice(1, 3).some((t) => c.forbidRest.test(t)))
    reasons.push(`forbidden in top-2/3: ${titles.slice(1, 3).join(" | ")}`);
  if (c.requireAny && !titles.some((t) => c.requireAny.test(t)) && !c.requireAny.test(text))
    reasons.push(`no title/body match ${c.requireAny}`);
  if (c.requireBlob && !c.requireBlob.test(text)) reasons.push("blob missing required note/portal");
  if (c.forbid && titles.some((t) => c.forbid.test(t))) reasons.push("forbidden string in titles");
  if (c.forbidClauseInvent && /clause\s*5[^.]*says|clause 5 states/i.test(text)) reasons.push("invented clause");
  if (c.labOk && !/raipur/i.test(text)) reasons.push("no Raipur lab row");
  if (c.labOk && /accredited for IS 269/i.test(text)) reasons.push("claimed IS-specific accreditation");
  if (c.clarify && !shouldClarify(c.query)) reasons.push("expected disambiguation first");
  if (/google\.com\/search/i.test(text)) reasons.push("google search url in hits");
  if (c.followCue === true && !dbg.isFollowCue && !isFollowCue(c.query)) reasons.push("expected FOLLOW_CUE");
  if (c.followCue === false && dbg.isFollowCue) reasons.push("unexpected FOLLOW_CUE");
  if (c.switchedFamily && dbg.switchedFamily !== c.switchedFamily)
    reasons.push(`switchedFamily ${dbg.switchedFamily} != ${c.switchedFamily}`);
  if (c.rewriteHas && !c.rewriteHas.test(rq)) reasons.push(`rewrite miss ${c.rewriteHas}: ${rq.slice(0, 180)}`);
  if (c.rewriteHas2 && !c.rewriteHas2.test(rq)) reasons.push(`rewrite miss ${c.rewriteHas2}: ${rq.slice(0, 180)}`);
  if (c.rewriteHas3 && !c.rewriteHas3.test(rq)) reasons.push(`rewrite miss ${c.rewriteHas3}: ${rq.slice(0, 180)}`);
  if (c.rewriteForbid && c.rewriteForbid.test(rq)) reasons.push(`rewrite has forbidden ${c.rewriteForbid}`);

  if (intent === "bis") {
    const fb = groundedFallback(rq, "en");
    if (/google\.com\/search/i.test(fb)) reasons.push("google search url in fallback");
    if (/([^a-z]|^)akonline\.in/i.test(fb)) reasons.push("truncated manakonline host in fallback");
    if (/Submit with no docs\/fee|Get instant registration/i.test(fb)) reasons.push("forbidden fee/instant phrase in fallback");
    if (c.fallbackForbid && c.fallbackForbid.test(fb)) reasons.push("fallback has forbidden jeweller/process string");
    if (c.fallbackRequire && !c.fallbackRequire.test(fb)) reasons.push(`fallback missing ${c.fallbackRequire}`);
    if (c.fallbackNoProcess && /\[PROCESS_STEPS\]/.test(fb) && JEWELLER_STEP_FORBID.test(fb)) {
      reasons.push("clarify still emits jeweller PROCESS_STEPS");
    }
    if (c.clarify && /\[PROCESS_STEPS\]/.test(fb)) reasons.push("clarify must not emit PROCESS_STEPS");
  }
  if (c.expectIntent === "social" && /IS 269/.test(rq)) reasons.push("social follow-up invented IS 269");

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

for (const l of APP_LANGS) {
  const reasons = [];
  const ui = UI_DICTIONARY[l.id];
  const sh = FALLBACK_SHELL[l.id];
  const social = socialReply(l.id);
  if (!ui?.welcomeTitle || !ui?.composerPlaceholder || !ui?.emptyQuery) reasons.push("incomplete UI pack");
  if (!sh?.title || !sh?.refuse || !sh?.followYes) reasons.push("incomplete fallback shell");
  if (l.id !== "en" && ui.composerPlaceholder === UI_DICTIONARY.en.composerPlaceholder) reasons.push("empty gloss: composer still English");
  if (l.id !== "en" && sh.title === FALLBACK_SHELL.en.title) reasons.push("empty gloss: fallback still English");
  if (!social.includes("[FOLLOW_UP]") || !social.includes("[META]")) reasons.push("social tags missing");
  if (l.id !== "en" && /Namaste — I am/.test(social) && l.id !== "en") reasons.push("social still English");
  if (/##\s*Applicable|Comprehensive Overview/.test(social)) reasons.push("essay heading in social");
  if (/google\.com\/search/i.test(social)) reasons.push("google search url");
  const pass = reasons.length === 0;
  if (!pass) failed += 1;
  rows.push({
    id: `lang-${l.id}`,
    pass,
    intent: "n/a",
    family: null,
    hasEvidence: false,
    top3: [ui?.welcomeTitle || "", sh?.title || ""],
    reasons,
  });
}

console.log(JSON.stringify({ failed, total: rows.length, rows }, null, 2));
process.exit(failed ? 1 : 0);
