import assert from "node:assert/strict";
import { APP_LANGS } from "../src/lib/language.ts";
import {
  checkHuid,
  certScheme,
  findHallmark,
  huidToken,
  moreKind,
  moreReply,
} from "../src/lib/more-desk.ts";

const BANNED = /I refuse|as an AI|verified genuine|licence granted|complaint has been filed|we have received your complaint/i;
const HUID_URL = "https://huid.manakonline.in/MANAK/HallmarkingHomePage";
const CRS_URL = "https://www.crsbis.in/BIS/about-crs.do";
const BIS_URL = "https://www.bis.gov.in";
const COMPLAINT_URL = "https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en";

function expectReply(query, kind) {
  assert.equal(moreKind(query), kind, query);
  const reply = moreReply(query, "en");
  assert.equal(typeof reply, "string", query);
  assert.match(reply, /1\. /, query);
  assert.match(reply, /\[SOURCE\]/, query);
  assert.match(reply, /\[FOLLOW_UP\]/, query);
  assert.match(reply, /\[META\]/, query);
  const follow = reply.split("\n").find((line) => line.startsWith("[FOLLOW_UP]"));
  assert.ok(follow && !follow.includes("?"), query);
  assert.doesNotMatch(reply, BANNED, query);
  return reply;
}

assert.equal(huidToken("HUID-AB12CD"), "AB12CD");
assert.equal(huidToken("AB१२CD"), "AB12CD");
assert.equal(checkHuid("FAN123").status, "bad");
assert.equal(checkHuid("123456").status, "bad");
assert.equal(checkHuid("ABCDEF").status, "bad");
assert.equal(checkHuid("AB12CD").status, "ok");
assert.equal(checkHuid("CM/L-1234567").status, "licence");

assert.equal(moreKind("verify CM/L-1234567"), null);
assert.equal(moreKind("check R-41000001"), null);
assert.equal(moreKind("IS 269 cement"), null);
assert.equal(moreKind("what is the fee for ISI"), null);
assert.equal(moreKind("clause 5 of the standard"), null);
assert.equal(moreKind("ipl score"), null);
assert.equal(moreKind("cement"), null);
assert.equal(moreKind(""), null);
assert.equal(moreKind("x".repeat(601)), null);

const gold = findHallmark("916 gold");
assert.equal(gold.grade?.id, "916");
const karat = findHallmark("22 कैरेट सोना");
assert.equal(karat.grade?.id, "916");
const bare900 = findHallmark("hallmark 900");
assert.equal(bare900.ambiguous900, true);
assert.equal(bare900.grade?.id, "900");
const plat = findHallmark("platinum 900");
assert.equal(plat.grade?.id, "pt900");
assert.equal(plat.ambiguous900, false);

const cement = expectReply("which indian standard for cement", "standards");
assert.match(cement, /IS 269/);
assert.equal(moreKind("find the Indian Standard for cement"), "standards");
assert.equal(moreKind("indian standard for helmet"), "standards");

const crs = expectReply("how to apply for crs", "certify");
assert.match(crs, new RegExp(CRS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(crs, /Scheme-II|CRS/);
assert.equal(certScheme("how to apply for fmcs"), "fmcs");
const fmcs = moreReply("how to apply for fmcs", "en");
assert.match(fmcs, new RegExp(`${BIS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
assert.doesNotMatch(fmcs, /fmcs\.bis|foreign-manufacturers/i);
assert.equal(certScheme("certification process for laptop"), "crs");
assert.equal(moreKind("certification process for gold jewellery"), "hallmark");

const huid = expectReply("verify huid AB12CD", "huid");
assert.match(huid, /AB12CD/);
assert.match(huid, new RegExp(HUID_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(huid, /not a live|Not a live/i);

const complaint = expectReply("file a complaint about a fake mark", "complaint");
assert.match(complaint, new RegExp(COMPLAINT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(complaint, /complaints@bis\.gov\.in/);
expectReply("contact us", "contact");
assert.equal(moreKind("BIS से संपर्क करें"), "contact");
assert.equal(moreKind("शिकायत दर्ज करो"), "complaint");

const hi = moreReply("verify huid AB12CD", "hi");
const en = moreReply("verify huid AB12CD", "en");
assert.notEqual(hi, en);
assert.match(hi, /[\u0900-\u097F]/);
assert.match(hi, /AB12CD/);

for (const lang of APP_LANGS) {
  if (lang.id === "en") continue;
  const body = moreReply("how to apply for crs", lang.id);
  assert.notEqual(body, moreReply("how to apply for crs", "en"), lang.id);
  assert.match(body, /CRS/);
  assert.match(body, new RegExp(CRS_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(body, BANNED);
}

const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const digits = "23456789";
let n = 0;

for (let i = 0; i < 420; i += 1) {
  const code = `${letters[i % letters.length]}${digits[(i * 3) % digits.length]}${letters[(i * 5) % letters.length]}${digits[(i * 7) % digits.length]}${letters[(i * 11) % letters.length]}${digits[(i * 13) % digits.length]}`;
  const blocked = /^(HUID|FAN|MARK|TEST|FAKE|GOLD|TOY|CEM|ISI|BIS|LAB|PIPE|BULB|SOAP|MILK)/.test(code);
  const query = i % 2 === 0 ? `verify huid ${code}` : `HUID-${code}`;
  const reply = expectReply(query, "huid");
  if (blocked) assert.match(reply, /does not match|not match/i, code);
  else assert.match(reply, new RegExp(code));
  assert.equal(checkHuid(code).status, blocked ? "bad" : "ok", code);
  n += 1;
}

const grades = [
  ["916 gold", "916"],
  ["22k", "916"],
  ["22K gold", "916"],
  ["18 carat", "750"],
  ["995", "995"],
  ["silver 925", "925"],
  ["platinum 950", "950"],
  ["14kt", "585"],
  ["9k", "375"],
  ["23k", "958"],
];
const hallPhrases = ["what is {g}", "{g} hallmark", "fineness {g}", "purity {g} jewellery"];
for (let i = 0; i < 160; i += 1) {
  const [sample, id] = grades[i % grades.length];
  const phrase = hallPhrases[i % hallPhrases.length].replace("{g}", sample);
  const reply = expectReply(phrase, "hallmark");
  const found = findHallmark(phrase);
  assert.equal(found.grade?.id, id, phrase);
  assert.match(reply, new RegExp(id === "pt900" ? "900" : id));
  n += 1;
}

const products = ["cement", "helmet", "ceiling fan", "steel utensils", "packaged drinking water"];
const stdPhrases = [
  "which indian standard for {p}",
  "find the indian standard for {p}",
  "indian standard for {p}",
  "what indian standard for {p}",
  "standards finder {p}",
];
for (let i = 0; i < 120; i += 1) {
  const product = products[i % products.length];
  const query = stdPhrases[i % stdPhrases.length].replace("{p}", product);
  expectReply(query, "standards");
  assert.equal(moreKind(`IS 269 ${product}`), null, product);
  n += 1;
}

const certPhrases = [
  ["how to apply for isi", "isi"],
  ["how do I apply for crs", "crs"],
  ["application process for fmcs", "fmcs"],
  ["certification process for laptop", "crs"],
  ["steps to apply for scheme ii", "crs"],
  ["how can I apply for foreign manufacturer fmcs", "fmcs"],
  ["how to apply isi for cement", "isi"],
];
for (let i = 0; i < 140; i += 1) {
  const [query, scheme] = certPhrases[i % certPhrases.length];
  const reply = expectReply(query, "certify");
  assert.equal(certScheme(query), scheme, query);
  if (scheme === "crs") assert.match(reply, /crsbis\.in/);
  if (scheme === "fmcs") assert.match(reply, /https:\/\/www\.bis\.gov\.in/);
  if (scheme === "isi" && /cement/i.test(query)) assert.match(reply, /IS 269/);
  n += 1;
}

const complaints = [
  "file a complaint",
  "I want to complain about a fake ISI mark",
  "grievance for counterfeit mark",
  "misuse of the mark on a toy",
  "shikayat about fake mark",
  "शिकायत नकली मार्क",
];
for (let i = 0; i < 80; i += 1) {
  const query = complaints[i % complaints.length];
  const reply = expectReply(query, "complaint");
  assert.match(reply, /complaints@bis\.gov\.in/);
  assert.doesNotMatch(reply, /ManakMitra (has )?received|case number/i);
  n += 1;
}

const contacts = ["contact us", "BIS address please", "head office of BIS", "phone number of BIS", "manak bhavan address", "BIS से संपर्क"];
for (let i = 0; i < 60; i += 1) {
  const reply = expectReply(contacts[i % contacts.length], "contact");
  assert.match(reply, /Manak Bhavan|मानक भवन|Bahadur/i);
  n += 1;
}

const negatives = [
  "ipl score today",
  "cricket world cup",
  "verify CM/L-1234567",
  "check R-41000001",
  "tell me the title of IS 269",
  "what is the marking fee",
  "clause of IS 269",
  "hello",
  "cement",
  "laptop",
  "nearest lab for cement pin 492001",
];
for (let i = 0; i < 80; i += 1) {
  const query = negatives[i % negatives.length];
  assert.equal(moreKind(query), null, query);
  assert.equal(moreReply(query, "en"), null, query);
  n += 1;
}

const fuzz = ["", " ", "???", "916", "ह्यूइड AB12CD", "AB12CD", "FAN123", "123456", "ABCDEF", "how to apply hallmark", "22k gold chain"];
for (let i = 0; i < 80; i += 1) {
  const query = i % 11 === 0 ? `${fuzz[i % fuzz.length]} ${"y".repeat(i)}` : fuzz[i % fuzz.length];
  let reply = null;
  assert.doesNotThrow(() => {
    reply = moreReply(query.slice(0, 800), APP_LANGS[i % APP_LANGS.length].id);
  }, query);
  if (reply) {
    assert.doesNotMatch(reply, BANNED);
    assert.match(reply, /\[FOLLOW_UP\] [^\n?]+\n\[META\]/);
  }
  n += 1;
}

assert.ok(n >= 1000, `expected at least 1000 queries, ran ${n}`);
console.log(`more-desk queries ${n}`);
