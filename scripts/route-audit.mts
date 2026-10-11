import { classifyIntent } from "../src/lib/intent.ts";
import { chatHardCard, deskKind } from "../src/lib/desk-route.ts";
import { moreKind } from "../src/lib/more-desk.ts";
import { isHallmarkSchemeMix, matchProductFamily } from "../src/lib/product-playbook.ts";
import { vectorRetrieve } from "../src/lib/rag.ts";

const cases: { q: string; expect: string }[] = [
  ["How to apply for ISI mark for ordinary portland cement", "bis"],
  ["cementt ke liye ISI kaise milega", "bis"],
  ["siment standard kya hai", "bis"],
  ["What is IS 269", "bis"],
  ["IS 269 kis product ke liye hai", "bis"],
  ["Fan pe HUID kaise check karun", "mix"],
  ["how to check huid on a room cooler", "mix"],
  ["How do I verify gold HUID", "bis-huid"],
  ["22k gold hallmark", "bis-huid"],
  ["hallmrk on gold ring", "bis-huid"],
  ["Helmet ke liye BIS kaise milega", "clarify"],
  ["laptop CRS registration", "bis"],
  ["Raipur me testing lab kahan hai", "labs"],
  ["find labs near 492001", "labs"],
  ["verify CM/L-7654321", "licence"],
  ["product file for cement", "file"],
  ["hello", "social"],
  ["What is the weather today", "off"],
  ["who won the ipl", "off"],
  ["pressure cooker BIS standard", "bis"],
  ["presure cooker standard", "bis"],
  ["certifcation process for cement", "bis"],
  ["indian standrd for helmet", "clarify"],
  ["complain about fake ISI mark", "bis"],
  ["contact us BIS head office", "bis"],
  ["what is bis", "bis"],
  ["Hindi: सीमेंट के लिए ISI", "bis"],
  ["How to apply hallmark as a jeweller", "bis-huid"],
  ["IS 5522 kis product ke liye hai", "bis"],
  ["clause 5 of IS 269", "bis"],
];

let bad = 0;
for (const [q, expect] of cases) {
  const intent = classifyIntent(q);
  const hard = chatHardCard(q);
  const desk = deskKind(q);
  const more = moreKind(q);
  const fam = matchProductFamily(q);
  const mix = isHallmarkSchemeMix(q, fam);
  const ret = vectorRetrieve(q);
  const top = ret.hits[0]?.title?.slice(0, 70) || "(none)";
  const flags = [
    intent,
    hard ? `hard:${hard}` : "",
    desk ? `desk:${desk}` : "",
    more ? `more:${more}` : "",
    mix ? "MIX" : "",
    fam ? `fam:${fam.id}` : "",
    ret.hasEvidence ? `hits:${ret.hits.length}` : "NOHITS",
  ]
    .filter(Boolean)
    .join(" ");
  let ok = true;
  if (expect === "off" && intent !== "offtopic") ok = false;
  if (expect === "social" && intent !== "social") ok = false;
  if (expect === "mix" && !mix) ok = false;
  if (expect === "licence" && hard !== "licence") ok = false;
  if (expect === "file" && hard !== "file") ok = false;
  if (expect === "labs" && (desk !== "labs" || intent !== "bis")) ok = false;
  if (expect === "bis" && (intent !== "bis" || mix)) ok = false;
  if (expect === "bis-huid" && (intent !== "bis" || mix)) ok = false;
  if (expect === "clarify" && !fam?.disambiguate) ok = false;
  if ((expect === "bis" || expect === "bis-huid" || expect === "clarify" || expect === "mix") && !ret.hasEvidence) ok = false;
  if (!ok) bad += 1;
  console.log(`${ok ? "OK" : "BAD"} [${expect}] ${flags}\n  Q: ${q}\n  TOP: ${top}`);
}
console.log(`\n${bad} bad / ${cases.length}`);
process.exit(bad ? 1 : 0);
