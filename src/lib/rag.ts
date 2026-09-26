import bundledPack from "@/data/rag-pack.json";
import verifiedBoost from "@/data/verified-boost.json";
import inboxBoost from "@/data/inbox-boost.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EvidenceHit, Retrieval } from "@/lib/rag-types";
import { matchProductFamily, schemeNeedles, CLAUSE_ASK, shouldClarify, type ProductFamily, HALLMARK_CUE, isHallmarkSchemeMix, JEWELLERY_CUE, glossIndic } from "@/lib/product-playbook";

type Chunk = { id: string; kind: EvidenceHit["kind"]; title: string; body: string; url: string };
type Pack = {
  verified: string;
  verifiedAt?: string;
  vocab: string[];
  idf: number[];
  docs: { i: number[]; v: number[] }[];
  chunks: Chunk[];
  catalogue?: Chunk[];
};

function loadPack(): Pack {
  try {
    if (import.meta.env.DEV) {
      const p = join(process.cwd(), "src/data/rag-pack.json");
      return JSON.parse(readFileSync(p, "utf8")) as Pack;
    }
  } catch {
    // published / serverless has no src/data on disk — use the bundled copy
  }
  try {
    return bundledPack as Pack;
  } catch {
    return { verified: "2026-09-12", vocab: [], idf: [], docs: [], chunks: [], catalogue: [] };
  }
}

const rag = loadPack();
rag.chunks = [
  ...rag.chunks,
  ...(verifiedBoost as Chunk[]).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    body: c.body,
    url: c.url,
  })),
  ...(inboxBoost as Chunk[]).map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    body: c.body,
    url: c.url,
  })),
];
const vocabIndex = new Map(rag.vocab.map((t, i) => [t, i]));
const catalogue = rag.catalogue || [];

const TOKEN_RE = /[a-z0-9]+|[\u0900-\u097f]+/gi;
const STOP = new Set(
  "a an the of for to in on and or is are with from by as at be this that your my i we you kya hai ke ki ka ko se mein aur ek please tell me about what how can do get apply bis indian standard standards batao bata bataye yaar bhai bro sir madam mujhe hume hame chahiye kaunsa konsa kaunsi kis liye wala wali wale hota hote karun karo karna pls pe par kaise kese kyu kyon matlab nahi nahin abhi thoda dekho dekh samjhao samjha product products kisliye".split(
    " ",
  ),
);

const SYNONYMS: Record<string, string[]> = {
  bottle: ["pet", "container", "packaging", "packaged", "terephthalate", "polyalkylene"],
  plastic: ["plastics", "pet", "pbt", "packaging"],
  pet: ["terephthalate", "polyalkylene", "pbt"],
  gold: ["hallmark", "huid", "jewellery", "jewelry", "carat", "fineness", "1417", "1418"],
  jewellery: ["gold", "hallmark", "huid", "fineness"],
  jewelry: ["gold", "hallmark", "huid"],
  hallmark: ["huid", "gold", "jewellery", "fineness"],
  huid: ["hallmark", "gold", "verify", "care"],
  care: ["huid", "hallmark", "complaint", "app"],
  lab: ["laboratory", "testing", "recognised"],
  laboratory: ["lab", "testing", "recognised"],
  laptop: ["notebook", "tablet", "electronics", "crs"],
  charger: ["adapter", "electronics", "crs"],
  solar: ["photovoltaic", "crs", "mnre"],
  isi: ["licence", "license", "certification", "scheme"],
  crs: ["compulsory", "registration", "electronics", "scheme"],
  fee: ["application", "inspection", "marking", "licence"],
  complaint: ["grievance", "consumer", "cmed"],
  iso: ["is/iso", "iec", "adoption", "identical", "9001", "14001", "difference"],
  iec: ["is/iec", "iso", "adoption"],
  scheme: ["isi", "crs", "fmcs", "registration", "licence"],
  registration: ["crs", "compulsory", "scheme"],
  explore: ["bureau", "services", "act", "know"],
  bureau: ["national", "standards", "body"],
  helmet: ["helmets", "protective", "industrial", "safety", "visor", "bicycle", "scooter"],
  helmets: ["helmet", "protective", "industrial", "safety"],
  cement: ["portland", "ordinary", "clinker"],
  portland: ["cement", "ordinary"],
  mixer: ["mixers", "dough", "planetary", "food"],
  grinder: ["grinding", "household"],
  tyre: ["tire", "tyres", "tires", "automotive"],
  television: ["tv", "receiver", "crs"],
  microwave: ["oven", "crs"],
  syringe: ["hypodermic", "sterile"],
  tile: ["ceramic", "pressed"],
  utensil: ["utensils", "stainless", "bartan", "5522"],
  utensils: ["utensil", "stainless", "sheets", "strips", "5522"],
  stainless: ["steel", "utensils", "5522"],
  geyser: ["heater", "storage", "water", "2082"],
  paver: ["paving", "block", "15658"],
  paving: ["paver", "block"],
  induction: ["stove", "cooktop", "crs"],
  printer: ["plotter", "crs"],
  smartphone: ["mobile", "handset", "16333", "crs"],
  vest: ["visibility", "warning", "15809"],
  pipe: ["pvc", "upvc", "unplasticized", "potable"],
  kettle: ["electric", "jugs", "367"],
  drinking: ["water", "10500", "piped"],
  wiring: ["cable", "pvc", "694"],
  cutlery: ["holloware", "15104"],
  nabl: ["17025", "laboratory", "lims"],
  msme: ["manakonline", "scheme", "licence"],
  agmark: ["not", "bis", "scheme"],
};

function tokens(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) || []).filter((t) => t.length > 1 && !STOP.has(t));
}

function ngrams(toks: string[]): string[] {
  const out = [...toks];
  for (let i = 0; i < toks.length - 1; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
  return out;
}

function expandQuery(q: string): string {
  let glossed = glossIndic(q);
  const raw = tokens(glossed);
  const extra: string[] = [];
  for (const t of raw) extra.push(...(SYNONYMS[t] || []));
  if (raw.includes("pet") || (raw.includes("plastic") && raw.includes("bottle"))) {
    extra.push("polyalkylene", "terephthalates", "foodstuffs", "pharmaceuticals");
  }
  return `${glossed} ${extra.join(" ")}`;
}

function embedSparse(text: string): Map<number, number> {
  const counts = new Map<string, number>();
  for (const g of ngrams(tokens(text))) counts.set(g, (counts.get(g) || 0) + 1);
  const vec = new Map<number, number>();
  let nrm = 0;
  for (const [term, tf] of counts) {
    const i = vocabIndex.get(term);
    if (i === undefined) continue;
    const w = (1 + Math.log(tf)) * rag.idf[i];
    vec.set(i, w);
    nrm += w * w;
  }
  nrm = Math.sqrt(nrm) || 1;
  for (const [i, w] of vec) vec.set(i, w / nrm);
  return vec;
}

function cosine(qv: Map<number, number>, doc: { i: number[]; v: number[] }): number {
  let s = 0;
  for (let n = 0; n < doc.i.length; n++) {
    const w = qv.get(doc.i[n]);
    if (w) s += w * doc.v[n];
  }
  return s;
}

function isNumbers(query: string): string[] {
  const out: string[] = [];
  const re = /\bIS[\s/.-]*(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query))) out.push(m[1]);
  return out;
}

/** Query-only: also accept messy identifiers like "5522 2014" or "Indian Standard 269". */
function queryIsNumbers(query: string): string[] {
  const out = isNumbers(query);
  const reIndian = /\bindian\s+standards?\s+(\d{3,5})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = reIndian.exec(query))) out.push(m[1]);
  const reYear = /(?:^|[^\dA-Za-z])(\d{3,5})\s*[:/\-]\s*((?:19|20)\d{2})\b/g;
  while ((m = reYear.exec(query))) {
    if (catPost.isn.has(m[1])) out.push(m[1]);
  }
  const reSpaceYear = /(?:^|[^\dA-Za-z])(\d{3,5})\s+((?:19|20)\d{2})\b/g;
  while ((m = reSpaceYear.exec(query))) {
    if (catPost.isn.has(m[1])) out.push(m[1]);
  }
  return [...new Set(out)];
}

const QUERY_PRODUCT =
  /\b(transformers?|industrial valves?|valves?|agricultural pumps?|pumps?|routers?|earbuds?|bluetooth|lithium[\s-]?ion|batteries|battery|x-?ray|elevator cables?|chemical fertilizers?|fertilizers?|smart speakers?|medical devices?|helmets?|cements?|laptops?|cookers?|toys?|plugs?|switches?|refrigerators?|electric irons?|irons?|cylinders?|footwear|utensils?|printers?|speakers?|gas cylinders?|set-top boxes?|scanners?|wireless keyboards?|keyboards?|infant foods?|smartwatches?|servers?|compressiv\w*|cctv|flammability)\b/i;

function productNeedles(q: string): string[] {
  const out: string[] = [];
  const re = new RegExp(QUERY_PRODUCT.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[0].toLowerCase());
  return [...new Set(out)];
}

function titleMatchesNeedles(title: string, needles: string[]): boolean {
  if (!needles.length) return true;
  const t = title.toLowerCase();
  return needles.some((n) => {
    const parts = n
      .replace(/-/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2);
    if (!parts.length) return t.includes(n);
    return parts.every((p) => t.includes(p.replace(/s$/, "")));
  });
}

function packHasNoTableAsk(q: string): boolean {
  return /sampling guideline|transition time|transition from an old is|amendment is issued|software or ai|ai components|specific clause of is|which clause of is|clause of is|test method for|is updated|re-test|not covered by is|proprietary technology|acceptable limit for|maximum allowable limit|calibration intervals|innovation licence|innovation license|flammability tests|liability of a trader|according to is\s*\d+/i.test(
    q,
  );
}

function coverage(queryToks: string[], hay: string): number {
  if (!queryToks.length) return 0;
  const h = hay.toLowerCase();
  return queryToks.filter((t) => h.includes(t)).length / queryToks.length;
}

function buildPostings(rows: Chunk[]): { tok: Map<string, number[]>; isn: Map<string, number[]> } {
  const tok = new Map<string, number[]>();
  const isn = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const blob = `${rows[i].title} ${rows[i].body}`;
    const seen = new Set<string>();
    for (const t of tokens(blob)) {
      if (seen.has(t)) continue;
      seen.add(t);
      const arr = tok.get(t);
      if (arr) arr.push(i);
      else tok.set(t, [i]);
    }
    for (const id of isNumbers(blob)) {
      const arr = isn.get(id);
      if (arr) arr.push(i);
      else isn.set(id, [i]);
    }
  }
  return { tok, isn };
}

const richPost = buildPostings(rag.chunks);
const catPost = buildPostings(catalogue);

function candidateIds(
  post: { tok: Map<string, number[]>; isn: Map<string, number[]> },
  queryToks: string[],
  ids: string[],
  cap: number,
): number[] {
  const scores = new Map<number, number>();
  for (const id of ids) {
    for (const i of post.isn.get(id) || []) scores.set(i, (scores.get(i) || 0) + 10);
  }
  for (const t of queryToks) {
    const extra = SYNONYMS[t] || [];
    for (const term of [t, ...extra]) {
      const list = post.tok.get(term);
      if (!list) continue;
      const w = extra.includes(term) ? 0.55 : 1;
      for (const i of list) scores.set(i, (scores.get(i) || 0) + w);
    }
  }
  if (!scores.size) return [];
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([i]) => i);
}

function toHit(ch: Chunk, score: number): EvidenceHit {
  return {
    kind: ch.kind,
    title: ch.title,
    body: ch.body,
    url: ch.url,
    score: Math.round(score * 1000) / 1000,
  };
}

const CITIES =
  /\b(new delhi|navi mumbai|greater noida|raipur|mumbai|delhi|chennai|kolkata|hyderabad|bengaluru|bangalore|bengulur|pune|ahmedabad|ahemdabad|ahmadabad|lucknow|jaipur|nagpur|nashik|nasik|bhopal|indore|surat|kanpur|patna|chandigarh|guwahati|howrah|dhanbad|faridabad|ghaziabad|ludhiana|meerut|ranchi|jodhpur|gwalior|kota|madurai|vadodara|bhubaneswar|amritsar|agra|varanasi|rajkot|thane|noida|ranipet|isnapur|gurgaon|gurugram|mohali|sonepat|sonipat|bahadurgarh|panchkula|coimbatore|dehradun|gandhinagar|mysuru|mysore|jalandhar|haridwar|kochi|cochin|aurangabad|vijayawada|visakhapatnam|vishakhapatnam|rohtak|ambala|hisar|karnal|bhilai|panipat|udaipur|thiruvananthapuram|trivandrum|shimla)\b/i;

const LAB_ASK = /\blabs?\b|\blaborator(?:y|ies)\b|\blims\b|प्रयोगशाला/i;

/** City + lab ask — hybrid extras only when pack has no city lab yet. */
export function isLabCityQuery(q: string): boolean {
  return LAB_ASK.test(q) && CITIES.test(q);
}

const CITY_EXPAND: Record<string, string[]> = {
  gurgaon: ["gurgaon", "gurugram"],
  gurugram: ["gurgaon", "gurugram"],
  sonepat: ["sonepat", "sonipat"],
  sonipat: ["sonepat", "sonipat"],
  nashik: ["nashik", "nasik"],
  nasik: ["nashik", "nasik"],
  delhi: ["delhi", "new delhi"],
  "new delhi": ["new delhi", "delhi"],
  mumbai: ["mumbai", "navi mumbai"],
  "navi mumbai": ["navi mumbai", "navi mumabi"],
  mysore: ["mysore", "mysuru"],
  mysuru: ["mysore", "mysuru"],
  kochi: ["kochi", "cochin"],
  cochin: ["kochi", "cochin"],
  visakhapatnam: ["visakhapatnam", "vishakhapatnam"],
  vishakhapatnam: ["visakhapatnam", "vishakhapatnam"],
  ahmedabad: ["ahmedabad", "ahemdabad", "ahmadabad"],
  ahemdabad: ["ahmedabad", "ahemdabad", "ahmadabad"],
  ahmadabad: ["ahmedabad", "ahemdabad", "ahmadabad"],
};

function isPlaceToken(s: string): boolean {
  const x = s.replace(/[()]/g, "").trim();
  if (x.length < 3 || x.length > 28) return false;
  if (/\d/.test(x)) return false;
  if (/pvt|ltd|llp|limited|laboratory|laboratories|\blabs?\b|engineers|private|aromatics|calf|godrej|tata\b/i.test(x)) {
    return false;
  }
  return /^[A-Za-z][A-Za-z .'-]*$/.test(x);
}

/** When Group-1 body has empty `City .`, take a trailing place from the lab title. */
function cityFromTitle(title: string): string {
  const t = title.trim();
  if (!t) return "";
  let last = "";
  const re = new RegExp(CITIES.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) last = m[0];
  if (last) {
    if (/north\s+delhi/i.test(t) && /delhi/i.test(last)) return "North Delhi";
    return last;
  }
  const parts = t.split(/\s[-–]\s+|\.\s+/);
  if (parts.length >= 2) {
    const tail = parts[parts.length - 1].replace(/[()]/g, "").trim();
    if (isPlaceToken(tail) && tail.toLowerCase() !== t.toLowerCase()) return tail;
  }
  return "";
}

function expandStateAbbrevs(body: string): string {
  return body
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

function enrichLabBody(title: string, body: string): string {
  let out = body;
  const cityM = out.match(/City\s+(.*?)\.\s*State/i);
  const city = (cityM ? cityM[1] : "").trim();
  if (!city) {
    const parsed = cityFromTitle(title);
    if (parsed) {
      if (/City\s+\./i.test(out)) out = out.replace(/City\s+\./i, `City ${parsed}.`);
      else if (/\bState\s+/i.test(out)) out = out.replace(/\bState\s+/i, `City ${parsed}. State `);
      else out = `${out} City ${parsed}.`;
    }
  }
  return expandStateAbbrevs(out);
}

for (const c of rag.chunks) {
  if (c.kind === "lab") c.body = enrichLabBody(c.title, c.body);
}

function exactIsChunk(id: string, prefer?: string): Chunk | undefined {
  let fallback: Chunk | undefined;
  for (const i of catPost.isn.get(id) || []) {
    const ch = catalogue[i];
    const nums = isNumbers(ch.title);
    if (nums[0] !== id) continue;
    if (!fallback) fallback = ch;
    if (prefer && `${ch.title} ${ch.body}`.toLowerCase().includes(prefer.toLowerCase())) return ch;
  }
  return fallback;
}

function aliasHitsText(alias: string, hay: string): boolean {
  const a = alias.toLowerCase().trim();
  const t = hay.toLowerCase();
  if (a.length < 4) return false;
  if (t.includes(a)) return true;
  const toks = a.split(/\s+/).filter((x) => x.length > 3);
  return toks.length > 0 && toks.every((x) => t.includes(x));
}

function pinFamilyHits(family: ProductFamily, seen: Set<string>): EvidenceHit[] {
  const out: EvidenceHit[] = [];
  if (family.scheme === "crs") {
    const scored = rag.chunks
      .filter((c) => c.kind === "crs" || c.kind === "product")
      .map((c) => {
        const hay = `${c.title} ${c.body}`;
        let s = 0;
        for (const a of family.aliases) {
          if (aliasHitsText(a, hay)) s += Math.min(a.length, 24);
        }
        return { c, s };
      })
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
    for (const { c } of scored.slice(0, family.is.length ? 2 : 3)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.94));
    }
  }
  for (const id of family.is) {
    const ch = exactIsChunk(id, family.preferTitle?.[id]);
    if (!ch || seen.has(ch.title)) continue;
    seen.add(ch.title);
    out.push(toHit(ch, 0.92));
  }
  return out;
}

function injectScheme(scheme: ProductFamily["scheme"], seen: Set<string>, out: EvidenceHit[]) {
  if (!scheme) return;
  const re = schemeNeedles(scheme);
  const rows = rag.chunks.filter(
    (c) => (c.kind === "process" || c.kind === "faq" || c.kind === "product" || c.kind === "crs" || c.kind === "hallmark") && re.test(`${c.title} ${c.body}`),
  );
  for (const c of rows.slice(0, 5)) {
    if (seen.has(c.title)) continue;
    seen.add(c.title);
    out.push(toHit(c, 0.55));
  }
}

function injectKeywordExtras(query: string, seen: Set<string>, out: EvidenceHit[]) {
  const ql = query.toLowerCase();
  const wantConsumer = /complaint|grievance|consumer|fake mark|fake logo|fake bis|शिकायत/.test(ql);
  const wantTrain = /training|workshop|standards club|मानक क्लब|प्रशिक्षण/.test(ql);
  const wantClause = CLAUSE_ASK.test(query);
  const wantLabLink =
    (CITIES.test(query) || /\blabs?\b|\blaborator(?:y|ies)\b|\blims\b|प्रयोगशाला/i.test(query)) &&
    !HALLMARK_CUE.test(query);
  const familyForMix = matchProductFamily(query);
  const schemeMix = isHallmarkSchemeMix(query, familyForMix);
  const wantCare =
    /care app|bis care/.test(ql) ||
    (!schemeMix && /huid|916|22k|18k|hallmark logo/.test(ql));
  const wantIso = /\biso\b|bis aur iso|bis vs iso|difference between bis/.test(ql);
  const wantFree = /for free|free pdf|free standard|muft/.test(ql);
  const wantFee = /\b(fee|fees|charges?|cost|costs|price|pricing|शुल्क|फीस)\b/.test(ql);
  const wantHq = /head\s*office|headquarters|manak bhawan|bahadur shah|zafar marg|contact bis|how to contact|enquiry directory|helpline/.test(ql);
  const wantSimplified = /simplified procedure|option-?[12]|\boption [12]\b/.test(ql);
  const wantCrsR =
    /\br-?number\b|registration number/.test(ql) &&
    !schemeMix &&
    familyForMix?.scheme !== "hallmark" &&
    !JEWELLERY_CUE.test(query);
  const wantAgmark = /\bagmark\b/.test(ql);
  const wantBee =
    /\bbee\b/.test(ql) ||
    /star label|energy label|5[\s-]?star|five[\s-]?star/.test(ql);
  const wantValidity =
    /\b(validity|valid for|kitne (din|saal) valid|licence valid|license valid|renewal)\b/.test(ql);
  const wantDownload =
    wantFree ||
    /download.*standard|full document|e-?sale|esale|buy.*standard|purchase.*standard/.test(ql);
  const wantMsme =
    (/\bmsmes?\b|small industr/.test(ql)) &&
    !HALLMARK_CUE.test(ql);
  const wantNabl = /\bnabl\b|17025/.test(ql);
  const wantWhatIs = /what (is|are) (an |the )?(bis|indian standards?)\b|how many indian standards?/.test(ql);
  const wantPenalty = /\bpenalt|uncertified|fake mark|compensation for fake/.test(ql);
  const wantFoodList = /food products?|iodized salt|name 3 important indian standards/.test(ql);
  const wantPaint = /\bpaints?\b|\bcoatings?\b/.test(ql) && !/aggregate|concrete/.test(ql);
  const wantImport = /\bimported\b|\bfmcs\b|foreign manufacturer/.test(ql);
  const wantDevelop = /process to develop|how (an |is )?(indian )?standard is developed|role of (bis|technical committees)/.test(ql);
  const wantFunded = /how is bis funded|bis funded|how is bis organised/.test(ql);
  if (
    !wantConsumer &&
    !wantTrain &&
    !wantClause &&
    !wantLabLink &&
    !wantCare &&
    !wantIso &&
    !wantFree &&
    !wantFee &&
    !wantHq &&
    !wantSimplified &&
    !wantCrsR &&
    !wantAgmark &&
    !wantBee &&
    !wantValidity &&
    !wantDownload &&
    !wantMsme &&
    !wantNabl &&
    !wantWhatIs &&
    !wantPenalty &&
    !wantFoodList &&
    !wantPaint &&
    !wantImport &&
    !wantDevelop &&
    !wantFunded
  )
    return;
  for (const c of rag.chunks) {
    if (c.kind !== "consumer" && c.kind !== "link" && c.kind !== "faq" && c.kind !== "hallmark" && c.kind !== "process")
      continue;
    const blob = `${c.title} ${c.body}`.toLowerCase();
    if (wantConsumer && /complaint|grievance|consumer|care|fake/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.5));
    }
    if (wantTrain && /training|enquiry|directory|contact|standards club|workshop/.test(blob) && !/what is bis/i.test(c.title)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      const titleHit = /training|standards club|workshop|enquiry directory/i.test(c.title);
      out.push(toHit(c, titleHit ? 0.9 : 0.55));
    }
    if (wantClause && /know your standard|e-sale|esale|download \/ purchase|purchase indian standards/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.7));
    }
    if (wantLabLink && /lims|group-1|group 1|group-2|recognised laborator|bis own laborator|testing laboratory directory/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.5));
    }
    if (wantCare) {
      const careTitle = /care app|bis care/i.test(c.title);
      const careBlob = /huid|care app|916|hallmark/.test(blob);
      if (careTitle || careBlob) {
        if (seen.has(c.title)) continue;
        seen.add(c.title);
        out.push(toHit(c, careTitle ? 0.88 : 0.62));
      }
    }
    if (wantIso && /iso|iec|difference/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.6));
    }
    if (wantFree && /e-sale|esale|sold|know your standard|clause/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.6));
    }
    if (wantFee && /application fee|inspection fee|fee for a bis product|rs\.?\s*1,?000|rs\.?\s*7,?000/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /fee for a bis product/i.test(c.title) ? 0.9 : 0.62));
    }
    if (wantHq && /headquarters|manak bhawan|bahadur shah|enquiry directory|110002/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /manak bhawan/i.test(blob) ? 0.95 : 0.55));
    }
    if (wantSimplified && /option-?[12]|simplified procedure|90 days|average time for grant/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /simplified procedure|option-2/i.test(c.title) ? 0.95 : 0.7));
    }
    if (wantCrsR && /r-number|registration \(r\)|registered-manufacturers|scheme-ii/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /r-number/i.test(c.title) ? 0.95 : 0.6));
    }
    if (wantAgmark && /agmark is not a bis|agmark/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /agmark is not/i.test(c.title) ? 0.98 : 0.7));
    }
    if (wantBee && /bee star|not the isi mark and not crs|energy-efficiency/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /bee star/i.test(c.title) ? 0.98 : 0.7));
    }
    if (wantValidity && /validity of a bis product|initially be granted for up to two years|renewed for up to five years/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /validity of a bis product/i.test(c.title) ? 0.96 : 0.7));
    }
    if (wantDownload && /e-sale|esale|know your standard|sold|clause text|download \/ purchase/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /free|e-sale|know your standard/i.test(c.title) ? 0.9 : 0.6));
    }
    if (wantMsme && /msme \/ small industry|same scheme-i \/ crs portals|manakonline/.test(blob) && !/indian language support/i.test(c.title)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /msme \/ small/i.test(c.title) ? 0.98 : 0.55));
    }
    if (wantNabl && /nabl \/ iso\/iec 17025|not a bis product licence|lims/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /nabl/i.test(c.title) ? 0.98 : 0.6));
    }
    if (wantWhatIs && /what are indian standards|how many indian standards are in this catalogue|what is bis/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /what are indian standards|how many indian standards/i.test(c.title) ? 0.97 : 0.7));
    }
    if (wantPenalty && /penalties for uncertified|fake bis \/ isi mark|online complaint/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /penalties for uncertified/i.test(c.title) ? 0.97 : 0.65));
    }
    if (wantFoodList && /food product is numbers|name the food|iodized salt|condensed milk/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /food product is numbers/i.test(c.title) ? 0.97 : 0.6));
    }
    if (wantPaint && /paint \/ coatings — do not use is 383|do not use is 383/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.98));
    }
    if (wantImport && /imported products — fmcs|foreign manufacturers certification/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /imported products — fmcs|fmcs/i.test(c.title) ? 0.97 : 0.65));
    }
    if (wantDevelop && /how an indian standard is developed|how iso and iec standards become/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /how an indian standard is developed/i.test(c.title) ? 0.97 : 0.7));
    }
    if (wantFunded && /how is bis organised \/ funded|manak bhawan/.test(blob)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, /funded/i.test(c.title) ? 0.97 : 0.7));
    }
    if (out.length >= 16) break;
  }
}
function uniqueHits(hits: EvidenceHit[]): EvidenceHit[] {
  const seen = new Set<string>();
  const out: EvidenceHit[] = [];
  for (const h of hits) {
    if (seen.has(h.title)) continue;
    seen.add(h.title);
    out.push(h);
  }
  return out;
}

function pinTitle(re: RegExp, score = 0.99): EvidenceHit[] {
  return rag.chunks
    .filter((c) => c.kind !== "standard" && re.test(c.title))
    .map((c) => toHit(c, score));
}

function attachAllied(merged: EvidenceHit[], query: string, seen: Set<string>, family: ProductFamily | null): EvidenceHit[] {
  const out = [...merged];
  const ids = new Set<string>();
  for (const h of merged) {
    for (const id of isNumbers(`${h.title} ${h.body}`)) ids.add(id);
  }
  for (const id of ids) {
    for (const i of (catPost.isn.get(id) || []).slice(0, 3)) {
      const ch = catalogue[i];
      if (!ch || seen.has(ch.title)) continue;
      const titleIds = isNumbers(ch.title);
      if (!titleIds.includes(id)) continue;
      seen.add(ch.title);
      out.push(toHit(ch, 0.22));
      if (out.length >= 10) break;
    }
    if (out.length >= 10) break;
  }

  const wantProcess =
    Boolean(family?.scheme) ||
    /\bprocess|steps?|scheme|certif|fee|licence|license|crs|isi|hallmark\b/i.test(query);
  const cityM = query.match(CITIES);
  const city = cityM ? cityM[1].toLowerCase() : "";

  if (city) {
    const needles = CITY_EXPAND[city] || [city];
    const labs = rag.chunks.filter((c) => c.kind === "lab");
    const ranked = labs
      .map((c) => {
        const blob = `${c.title} ${c.body}`.toLowerCase();
        let s = 0;
        if (needles.some((n) => blob.includes(n))) s += 2;
        return { c, s };
      })
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    for (const { c, s } of ranked) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.3 + s * 0.1));
    }
  }

  if (family?.scheme) injectScheme(family.scheme, seen, out);
  else if (wantProcess) {
    const kinds = new Set(["process", "faq", "product", "hallmark", "crs"]);
    const qToks = tokens(expandQuery(query));
    const scored = rag.chunks
      .filter((c) => kinds.has(c.kind))
      .map((c) => ({ c, s: coverage(qToks, `${c.title} ${c.body}`) }))
      .filter((r) => r.s >= 0.12)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4);
    for (const { c, s } of scored) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      out.push(toHit(c, 0.18 + s));
    }
  }

  injectKeywordExtras(query, seen, out);
  return out.slice(0, 14);
}

function policyEarlyHits(
  q: string,
  family: ReturnType<typeof matchProductFamily>,
  knownTyped: string[],
  unknownTyped: boolean,
  typedMismatch: boolean,
  noTableAsk: boolean,
  actSectionAsk: boolean,
): EvidenceHit[] | null {
  const mix = isHallmarkSchemeMix(q, family);
  const fakePortal =
    /\bnws\b|\blrs\b|\bcro\b|\btatkal\b|certification portal|laboratory portal|standardization portal|eco-mark scheme|system certification scheme|air approved labs|apply for (nws|lrs|cro|air|dpiit|meity|iec|iso|tatkal) certification/i.test(
      q,
    );
  const penalty =
    actSectionAsk ||
    /penalty|forging|compounding of offense|search and seizure|without a warrant|criminal liability|encash.{0,30}pbg|\bpbg\b|e-commerce platform|liability of an|consumer protection act intersect|legal precedent|contradiction between|ncr closure|stop[\s-]?marking|stop[\s-]?sale/i.test(
      q,
    );
  const sopTable =
    noTableAsk ||
    /calibration intervals|testing equipment is mandatory|exemption process|subsidy on|annual marking fee calculated|total fee for|guarantee that|won't break|homemade|falsifies .{0,40} data|does \w+ accept .{0,80} lab reports|dpiit approved labs|meity branch|iec branch|nearest \w+ office|quality mark|what exactly is the \w+ process|supersede existing|factory audit mandatory/i.test(
      q,
    );
  const farzi =
    /farzi|forged (isi|crs|huid|hallmark|eco|quality|certification|standard|bis label|registration)/i.test(q);
  const airAsk = /authorized indian representative|\(air\)|air process|can an air for|an air for|air branch|air ka|which air/i.test(q);
  const whatBis = /what is bis\b|बीआईएस क्या है|\bbis kya hai\b/i.test(q);
  const clauseAsk = CLAUSE_ASK.test(q);
  if (
    !(
      mix ||
      fakePortal ||
      penalty ||
      sopTable ||
      farzi ||
      airAsk ||
      typedMismatch ||
      unknownTyped ||
      whatBis ||
      clauseAsk
    )
  )
    return null;

  const pins: EvidenceHit[] = [];
  if (mix) pins.push(...pinTitle(/hallmark \/ huid applies only to jewellery/i, 0.99));
  if (typedMismatch) pins.push(...pinTitle(/is number vs product — do not mix catalogue rows/i, 0.99));
  if (unknownTyped) pins.push(...pinTitle(/is number not in this catalogue snapshot/i, 0.99));
  if (fakePortal) pins.push(...pinTitle(/nws \/ lrs \/ unknown portal/i, 0.99));
  if (airAsk) pins.push(...pinTitle(/imported products — fmcs/i, 0.99));
  if (whatBis) pins.push(...pinTitle(/what is bis —/i, 0.99));
  if (clauseAsk) {
    pins.push(...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.99));
    for (const id of knownTyped) {
      const ch = exactIsChunk(id);
      if (!ch) continue;
      pins.push({
        ...toHit(ch, 0.95),
        body: `${ch.body}\nNOTE: Full clause text of paid Indian Standards is NOT stored. Do not invent clause wording. Direct the user to Know Your Standard and the official e-Sale portal in these hits.`,
      });
    }
    pins.push(...pinTitle(/know your standard — look up/i, 0.93));
  }
  if (penalty || farzi) {
    pins.push(...pinTitle(/stop marking \/ stop-sale \/ ncr/i, 0.98));
    pins.push(...pinTitle(/penalties for uncertified/i, 0.94));
    pins.push(...pinTitle(/fake bis \/ isi mark/i, 0.9));
  }
  if (/eco[\s-]?mark/i.test(q)) pins.push(...pinTitle(/eco mark is a separate bis scheme/i, 0.99));
  if (sopTable || typedMismatch || unknownTyped || noTableAsk) {
    pins.push(...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.97));
    pins.push(...pinTitle(/know your standard — look up/i, 0.93));
  }
  if (!pins.length) {
    pins.push(...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.99));
    pins.push(...pinTitle(/know your standard — look up/i, 0.9));
  }
  return uniqueHits(pins).slice(0, 8);
}

export function vectorRetrieve(query: string): Retrieval {
  const q = glossIndic(query.trim());
  const family = matchProductFamily(q);
  const queryToks = tokens(q);
  const typedIds = queryIsNumbers(q);
  const knownTyped = typedIds.filter((id) => Boolean(exactIsChunk(id)));
  const unknownTyped = typedIds.length > 0 && knownTyped.length === 0;
  const needles = productNeedles(q);
  const mismatchedTyped = knownTyped.filter((id) => {
    const ch = exactIsChunk(id);
    if (!ch) return false;
    return needles.length > 0 && !titleMatchesNeedles(ch.title, needles);
  });
  const typedMismatch =
    mismatchedTyped.length > 0 &&
    !(family && knownTyped.some((id) => family.is.includes(id)));
  const noTableAsk = packHasNoTableAsk(q);
  const actSectionAsk = /bis act|under section\s+\d+|referencing section|legal mechanism|compensation/i.test(q);
  const alignedTyped = knownTyped.filter((id) => !mismatchedTyped.includes(id));
  const ids = [...new Set([...alignedTyped, ...(family?.is || [])])];
  const early = policyEarlyHits(q, family, knownTyped, unknownTyped, typedMismatch, noTableAsk, actSectionAsk);
  if (early && early.length) {
    const mix = isHallmarkSchemeMix(q, family);
    const extra: EvidenceHit[] = [];
    for (const id of knownTyped.slice(0, 2)) {
      const ch = exactIsChunk(id);
      if (ch) extra.push(toHit(ch, 0.96));
    }
    if (mix && family && family.scheme !== "hallmark") {
      for (const id of family.is.slice(0, 2)) {
        const ch = exactIsChunk(id);
        if (ch && !extra.some((h) => h.title === ch.title)) extra.push(toHit(ch, 0.92));
      }
    }
    const refusePin =
      mix ||
      typedMismatch ||
      unknownTyped ||
      noTableAsk ||
      CLAUSE_ASK.test(q) ||
      packHasNoTableAsk(q);
    return {
      query: q,
      hits: uniqueHits([...extra, ...early]).slice(0, 8),
      mode: mix ? "hallmarking" : family ? "standards" : "general",
      confidence: "high",
      hasEvidence: true,
      grounding: refusePin ? "refuse" : "verified",
    };
  }
  const expanded = family ? `${expandQuery(q)} ${family.id} ${family.is.map((n) => `IS ${n}`).join(" ")}` : expandQuery(q);
  const expToks = tokens(expanded);
  const qv = embedSparse(expanded);

  const richHits: EvidenceHit[] = [];
  const richCand = candidateIds(richPost, expToks, ids, 220);
  const richScored = richCand.map((i) => {
    let s = rag.docs[i] ? cosine(qv, rag.docs[i]) : 0;
    const ch = rag.chunks[i];
    const blob = `${ch.title} ${ch.body}`.toLowerCase();
    for (const id of ids) {
      if (blob.includes(id)) s += 0.4;
    }
    if (/scheme|what is|legal|steps|process|versus|explore|adopt/.test(q.toLowerCase())) {
      if (ch.kind === "process" || ch.kind === "faq" || ch.kind === "link" || ch.kind === "consumer") s += 0.22;
      if (ch.kind === "crs") s -= 0.08;
    }
    return { i, s };
  });
  richScored.sort((a, b) => b.s - a.s);
  for (const row of richScored.slice(0, 8)) {
    if (row.s < 0.08 && !ids.length) continue;
    richHits.push(toHit(rag.chunks[row.i], row.s));
    if (richHits.length >= 5) break;
  }

  const catHits: EvidenceHit[] = [];
  if (!(unknownTyped && !family)) {
  const catCand = candidateIds(catPost, expToks, ids, 250);
  const catScored = catCand.map((i) => {
    const ch = catalogue[i];
    const blob = `${ch.title} ${ch.body}`.toLowerCase();
    let s = 0;
    for (const id of ids) {
      if (ch.title.toLowerCase().includes(id) || blob.includes(id)) s += 0.7;
    }
    const cov = coverage(queryToks.length ? queryToks : expToks, blob);
    s += cov * 0.45;
    if (queryToks.some((t) => ch.title.toLowerCase().includes(t))) s += 0.08;
    const titleL = ch.title.toLowerCase();
    const bodyL = blob;
    const distinctive = (queryToks.length ? queryToks : expToks).filter((t) => t.length > 3);
    const titleHits = distinctive.filter((t) => titleL.includes(t)).length;
    if (titleHits) s += 0.28 * titleHits;
    // Prefer specification rows over incidental keyword hits (e.g. "cement" in a test method).
    if (distinctive.some((t) => t === "cement") && /portland|ordinary portland/.test(bodyL)) s += 0.35;
    if (distinctive.some((t) => t === "helmet") && /helmet/.test(titleL)) s += 0.3;
    if (distinctive.some((t) => t === "gold" || t === "jewellery" || t === "jewelry") && /1417|1418|hallmark/.test(bodyL))
      s += 0.25;
    if (distinctive.some((t) => t === "utensil" || t === "utensils") && /stainless|utensil/.test(bodyL)) s += 0.4;
    if (distinctive.some((t) => t === "geyser") && /water heater|storage type/.test(bodyL)) s += 0.4;
    if (distinctive.some((t) => t === "paver" || t === "paving") && /paving block/.test(bodyL)) s += 0.35;
    if (family?.id === "gold" && !/1417|1418|hallmark|jewel|fineness|huid|artefact/.test(bodyL)) s -= 1;
    if (family?.id === "pvc-pipe" && !/4985|unplasticized pvc pipes for potable/.test(bodyL)) s -= 0.4;
    if (family?.id === "stainless-utensils" && !/5522|15997|utensil/.test(bodyL)) s -= 0.4;
    if (family?.id === "geyser" && !/2082|water heater/.test(bodyL)) s -= 0.4;
    return { i, s, cov };
  });
  catScored.sort((a, b) => b.s - a.s);
  for (const row of catScored.slice(0, 8)) {
    if (row.s < 0.12 && !ids.length) continue;
    catHits.push(toHit(catalogue[row.i], row.s));
    if (catHits.length >= 6) break;
  }
  }

  const schemeQuery = /crs|scheme|isi|fmcs|hallmark|huid|fee|licence|license|iso|iec|lab|complaint|explore|bureau|act 2016|registration|\bcare app\b|\bcare\b/.test(
    q.toLowerCase(),
  );
  const seen = new Set<string>();
  const pinned = family ? pinFamilyHits(family, seen) : [];
  const merged: EvidenceHit[] = [...pinned];
  const prefer = schemeQuery && !ids.length ? [...richHits, ...catHits] : [...catHits, ...richHits];
  if (schemeQuery && richHits.length) {
    for (const h of richHits) {
      const k = h.title;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(h);
      if (merged.length >= 8) break;
    }
  }
  for (const h of prefer) {
    const k = h.title;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(h);
    if (merged.length >= 8) break;
  }

  const allied = attachAllied(merged, q, seen, family);
  let finalHits = allied.length ? allied : merged;

  const hallmarkAsk =
    !isHallmarkSchemeMix(q, family) &&
    !/who is the head|head of\b/i.test(q) &&
    (family?.scheme === "hallmark" || (HALLMARK_CUE.test(q) && !family));
  const labAsk =
    (CITIES.test(q) || /\blabs?\b|\blaborator(?:y|ies)\b|\blims\b|प्रयोगशाला/i.test(q)) && !hallmarkAsk;
  if (!labAsk) finalHits = finalHits.filter((h) => h.kind !== "lab");
  else {
    finalHits = finalHits.map((h) =>
      h.kind === "lab"
        ? {
            ...h,
            body: `${h.body}\nNOTE: Group-1 list is a published name/city list. Do not claim this lab is accredited to test a named IS. Confirm live scope on BIS LIMS https://lims.bis.gov.in/home/search_is_number/ and the Group-1 PDF.`,
          }
        : h,
    );
  }

  if (CLAUSE_ASK.test(q) && finalHits[0]) {
    finalHits[0] = {
      ...finalHits[0],
      body: `${finalHits[0].body}\nNOTE: Full clause text of paid Indian Standards is NOT stored. Do not invent clause wording. Direct the user to Know Your Standard and the official e-Sale portal in these hits.`,
    };
  }

  if (shouldClarify(q) && family?.disambiguate && finalHits[0]) {
    finalHits[0] = {
      ...finalHits[0],
      body: `${finalHits[0].body}\nNOTE: ${family.disambiguate}`,
    };
  } else if (family?.disambiguate && finalHits[0] && !family.is.length) {
    finalHits[0] = {
      ...finalHits[0],
      body: `${finalHits[0].body}\nNOTE: ${family.disambiguate}`,
    };
  }

  const wantTrainFinal = /training|workshop|standards club|मानक क्लब|प्रशिक्षण/i.test(q);
  if (wantTrainFinal) {
    const dedicated = rag.chunks
      .filter(
        (c) =>
          /standards club|training|workshop|मानक क्लब/i.test(c.title) &&
          c.kind !== "standard" &&
          !/what is bis/i.test(c.title),
      )
      .map((c) => toHit(c, 0.99));
    const pin = finalHits.filter(
      (h) =>
        /enquiry|directory|contact|training|standards club|workshop/i.test(`${h.title} ${h.body}`) &&
        h.kind !== "standard" &&
        !/what is bis/i.test(h.title),
    );
    const rest = finalHits.filter(
      (h) => !pin.includes(h) && h.kind !== "standard" && !/what is bis/i.test(h.title),
    );
    finalHits = uniqueHits(dedicated.length ? [...dedicated, ...pin, ...rest] : pin.length ? [...pin, ...rest] : rest);
  }

  const wantFeeFinal = /\b(fee|fees|charges?|cost|costs|price|pricing|शुल्क|फीस)\b/i.test(q);
  const hallmarkFeeAsk = wantFeeFinal && (family?.id === "gold" || /hallmark/i.test(q));
  if (wantFeeFinal && !hallmarkFeeAsk) {
    const fee = uniqueHits([
      ...rag.chunks
        .filter((c) => /what is the fee for a bis product certification/i.test(c.title))
        .map((c) => toHit(c, 0.98)),
      ...finalHits.filter(
        (h) =>
          h.kind !== "standard" &&
          /application fee|inspection fee|fee for a bis product|rs\.?\s*1,?000|rs\.?\s*7,?000/i.test(`${h.title} ${h.body}`),
      ),
    ]);
    const keepFam = family
      ? finalHits.filter((h) => {
          const n = isNumbers(h.title)[0];
          return Boolean(n && family.is.includes(n));
        })
      : [];
    const rest = finalHits.filter((h) => !fee.some((x) => x.title === h.title) && !keepFam.includes(h));
    finalHits = uniqueHits(keepFam.length ? [keepFam[0], ...fee, ...keepFam.slice(1), ...rest] : [...fee, ...rest]);
  }
  if (hallmarkFeeAsk) {
    const pin = uniqueHits([
      ...pinTitle(/hallmarking per-article assay charges/i, 0.99),
      ...finalHits.filter((h) => /huid|care app|hallmark/i.test(`${h.title} ${h.body}`) && h.kind !== "standard"),
    ]);
    finalHits = uniqueHits([...pin, ...finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title))]);
  }

  const cityMFinal = q.match(CITIES);
  if (labAsk && cityMFinal) {
    const city = cityMFinal[1].toLowerCase();
    const needles = CITY_EXPAND[city] || [city];
    const cityLabs = uniqueHits([
      ...rag.chunks
        .filter((c) => c.kind === "lab" && needles.some((n) => `${c.title} ${c.body}`.toLowerCase().includes(n)))
        .map((c) => toHit(c, 0.97)),
      ...finalHits.filter((h) => h.kind === "lab" && needles.some((n) => `${h.title} ${h.body}`.toLowerCase().includes(n))),
    ]);
    const fam = family
      ? finalHits.filter((h) => {
          const n = isNumbers(h.title)[0];
          return Boolean(n && family.is.includes(n));
        })
      : [];
    const rest = finalHits.filter(
      (h) => !cityLabs.some((x) => x.title === h.title) && !fam.includes(h) && h.kind !== "lab",
    );
    finalHits = uniqueHits(fam.length ? [fam[0], ...cityLabs, ...fam.slice(1), ...rest] : [...cityLabs, ...rest]);
  }

  const wantSimplifiedFinal = /simplified procedure|option-?[12]|\boption [12]\b/i.test(q);
  if (wantSimplifiedFinal) {
    const dedicated = rag.chunks
      .filter((c) => /simplified procedure|option-2/i.test(c.title) && c.kind !== "standard")
      .map((c) => toHit(c, 0.99));
    const pin = rag.chunks
      .filter(
        (c) =>
          c.kind !== "standard" &&
          /simplified procedure|option-?2|option-?1|90 days|average time for grant/i.test(`${c.title} ${c.body}`),
      )
      .map((c) => toHit(c, 0.8));
    const rest = finalHits.filter((h) => h.kind !== "standard");
    finalHits = uniqueHits([...dedicated, ...pin, ...rest]);
  }

  const wantHqFinal = /head\s*office|headquarters|manak bhawan|bahadur shah|zafar marg/i.test(q);
  if (wantHqFinal) {
    const pin = uniqueHits([
      ...rag.chunks
        .filter((c) => /manak bhawan|headquarters office|bahadur shah/i.test(`${c.title} ${c.body}`))
        .map((c) => toHit(c, 0.99)),
      ...finalHits.filter((h) => h.kind !== "standard"),
    ]);
    finalHits = uniqueHits(pin);
  }

  const wantCrsRFinal =
    /\br-?number\b|registration number/i.test(q) &&
    family?.scheme !== "hallmark" &&
    !isHallmarkSchemeMix(q, family) &&
    !JEWELLERY_CUE.test(q);
  if (wantCrsRFinal) {
    const dedicated = rag.chunks
      .filter((c) => /r-number|r number|registration \(r\)/i.test(c.title) && c.kind !== "standard")
      .map((c) => toHit(c, 0.99));
    const rest = finalHits.filter(
      (h) =>
        h.kind !== "standard" &&
        !dedicated.some((d) => d.title === h.title) &&
        !/huid|verify huid/i.test(h.title),
    );
    finalHits = uniqueHits([...dedicated, ...rest]);
  }

  const wantAgmarkFinal = /\bagmark\b/i.test(q);
  if (wantAgmarkFinal) {
    const pin = rag.chunks
      .filter((c) => /agmark is not a bis/i.test(c.title) && c.kind !== "standard")
      .map((c) => toHit(c, 0.99));
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((p) => p.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  const wantBeeFinal = /\bbee\b|star label|energy label|5[\s-]?star|five[\s-]?star/i.test(q);
  if (wantBeeFinal) {
    const pin = rag.chunks
      .filter((c) => /bee star label is not the isi/i.test(c.title) && c.kind !== "standard")
      .map((c) => toHit(c, 0.99));
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((p) => p.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  const wantValidityFinal =
    /\b(validity|valid for|kitne (din|saal) valid|licence valid|license valid|renewal)\b/i.test(q);
  if (wantValidityFinal) {
    const pin = uniqueHits([
      ...rag.chunks
        .filter((c) => /validity of a bis product certification licence/i.test(c.title))
        .map((c) => toHit(c, 0.98)),
      ...finalHits.filter((h) =>
        /up to two years|up to five years|validity of a bis product/i.test(`${h.title} ${h.body}`),
      ),
    ]);
    const rest = finalHits.filter((h) => !pin.some((x) => x.title === h.title) && h.kind !== "standard");
    finalHits = uniqueHits([...pin, ...rest]);
  }

  const wantDownloadFinal =
    /download.*standard|full document|e-?sale|esale|buy.*standard|purchase.*standard|for free|free pdf|free standard|muft/i.test(
      q,
    );
  if (wantDownloadFinal) {
    const pin = uniqueHits([
      ...rag.chunks
        .filter(
          (c) =>
            /can i get indian standards for free|know your standard — look up|e-sale/i.test(c.title) &&
            c.kind !== "standard",
        )
        .map((c) => toHit(c, 0.97)),
      ...finalHits.filter((h) =>
        /e-sale|esale|know your standard|sold/i.test(`${h.title} ${h.body}`),
      ),
    ]);
    const rest = finalHits.filter((h) => !pin.some((x) => x.title === h.title) && h.kind !== "standard");
    finalHits = uniqueHits([...pin, ...rest]);
  }

  const wantCareApp = /care app|bis care/i.test(q);
  if (wantCareApp) {
    const how = uniqueHits([
      ...rag.chunks
        .filter((c) => /care app|bis care/i.test(c.title) && !/complaint|grievance registration/i.test(c.title))
        .map((c) => toHit(c, 0.99)),
      ...finalHits.filter((h) => /care app|bis care/i.test(h.title) && !/complaint|grievance registration/i.test(h.title)),
    ]);
    const rest = finalHits.filter((h) => !how.some((x) => x.title === h.title) && h.kind !== "standard");
    finalHits = uniqueHits([...how, ...rest]);
  }

  if ((family?.id === "gold" || /916 gold|\b22k\b|\b18k\b/i.test(q)) && !isHallmarkSchemeMix(q, family)) {
    const purity = finalHits.filter(
      (h) =>
        h.kind !== "standard" && /916|22k|18k|huid|hallmark|jewel|artefact|care|fineness/i.test(`${h.title} ${h.body}`),
    );
    const std: EvidenceHit[] = [];
    for (const id of ["1417", "1418"] as const) {
      const ch = exactIsChunk(id);
      if (ch) std.push(toHit(ch, 0.91));
    }
    const rest = finalHits.filter((h) => h.kind !== "standard" && !purity.includes(h));
    const nine = purity.filter((h) => /916|22k|18k|huid|hallmark/i.test(h.title));
    const head = nine[0] ? [nine[0]] : purity.slice(0, 1);
    const tail = purity.filter((h) => h !== head[0]);
    finalHits = uniqueHits([...head, ...std, ...tail, ...rest]);
  }

  if (labAsk && !cityMFinal) {
    const lims = uniqueHits([
      ...pinTitle(/live LIMS list|testing laboratory directory|list of bis recognised laborator/i, 0.99),
      ...pinTitle(/nabl \/ iso\/iec 17025/i, 0.96),
    ]);
    const famHits = family
      ? finalHits.filter((h) => {
          const n = isNumbers(h.title)[0];
          return Boolean(n && family.is.includes(n));
        })
      : [];
    const rest = finalHits.filter(
      (h) =>
        h.kind !== "lab" &&
        (h.kind !== "standard" || famHits.includes(h)) &&
        !lims.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits(
      /\blims\b/i.test(q) || !famHits.length
        ? [...lims, ...famHits, ...rest.filter((h) => !famHits.includes(h))]
        : [famHits[0], ...lims, ...famHits.slice(1), ...rest.filter((h) => !famHits.includes(h))],
    );
  }

  if (/\bmsmes?\b|small industr/i.test(q) && !hallmarkAsk && !isHallmarkSchemeMix(q, family)) {
    const pin = uniqueHits([
      ...pinTitle(/msme \/ small industry/i, 0.99),
      ...pinTitle(/isi mark scheme-i — apply on manak/i, 0.9),
      ...pinTitle(/contact \/ enquiry directory/i, 0.88),
    ]);
    const rest = finalHits.filter(
      (h) => h.kind !== "crs" && h.kind !== "standard" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (isHallmarkSchemeMix(q, family)) {
    const pins: EvidenceHit[] = [
      ...pinTitle(/hallmark \/ huid applies only to jewellery/i, 0.99),
    ];
    if (/complaint|fake |kharab|file a complaint/i.test(q)) {
      pins.push(...pinTitle(/fake bis \/ isi mark or logo/i, 0.97));
      pins.push(...pinTitle(/consumer complaint/i, 0.94));
    }
    if (family?.scheme === "crs" || /\bcrs\b|laptop|smartphone|led/i.test(q)) {
      pins.push(...pinTitle(/crs notified products — confirm live/i, 0.93));
    } else if (family?.scheme === "isi") {
      pins.push(...pinTitle(/isi mark scheme-i — apply on manak/i, 0.93));
    }
    pins.push(...pinTitle(/know your standard — look up/i, 0.9));
    if (family?.id === "gold") {
      /* should not happen when schemeMix */
    }
    const pin = uniqueHits(pins);
    const famHits = family
      ? finalHits.filter((h) => {
          const n = isNumbers(h.title)[0];
          return Boolean(n && family.is.includes(n));
        })
      : [];
    const rest = finalHits.filter(
      (h) =>
        h.kind !== "hallmark" &&
        h.kind !== "lab" &&
        !/huid verification|verify a huid|gold 22 carat|gold 18 carat|assaying & hallmarking|per-article assay/i.test(
          h.title,
        ) &&
        !pin.some((x) => x.title === h.title) &&
        !famHits.includes(h),
    );
    finalHits = uniqueHits([...pin, ...famHits, ...rest]);
  }

  if (hallmarkAsk) {
    const pins: EvidenceHit[] = [];
    if (/\b(fee|fees|charges?|cost|capital|rate)\b/i.test(q)) {
      pins.push(...pinTitle(/hallmarking per-article assay charges/i, 0.99));
    }
    if (/penalt|fake hallmark|bina bech|uncertified/i.test(q)) {
      pins.push(...pinTitle(/penalties for uncertified/i, 0.98));
    }
    if (/\bahc\b|assaying|hallmarking centre|job work/i.test(q)) {
      pins.push(...pinTitle(/approach a bis-recognised assaying/i, 0.99));
    }
    if (/huid|care app|verify|check karo/i.test(q)) {
      pins.push(
        ...pinTitle(/how can a consumer verify a huid/i, 0.99),
        ...pinTitle(/hallmark \/ huid verification/i, 0.98),
        ...pinTitle(/bis care app|care mobile application/i, 0.97),
      );
    }
    if (/register|apply|licence|license|renew/i.test(q)) {
      pins.push(...pinTitle(/hallmarking: register online/i, 0.97));
    }
    if (/(?<!\d)22\s*k\b|\b916\b|(?<!\d)22\s*carat\b|(?<!\d)22\s*kt\b/i.test(q)) pins.push(...pinTitle(/gold 22 carat 22k 916/i, 0.98));
    if (/(?<!\d)18\s*k\b|\b750\b|(?<!\d)18\s*carat\b|(?<!\d)18\s*kt\b/i.test(q)) pins.push(...pinTitle(/gold 18 carat 18k 750/i, 0.98));
    if (/consist|symbol|punch|logo/i.test(q)) {
      pins.push(...pinTitle(/what does a bis hallmark consist/i, 0.97));
    }
    if (!pins.length) {
      pins.push(
        ...pinTitle(/hallmark \/ huid verification/i, 0.95),
        ...pinTitle(/approach a bis-recognised assaying/i, 0.93),
        ...pinTitle(/what does a bis hallmark consist/i, 0.91),
      );
    }
    if (family?.id === "gold") {
      const std: EvidenceHit[] = [];
      for (const id of ["1417", "1418"] as const) {
        const ch = exactIsChunk(id);
        if (ch) std.push(toHit(ch, 0.93));
      }
      if (std.length) {
        if (pins.length) pins.splice(Math.min(1, pins.length), 0, ...std);
        else pins.push(...std);
      }
    }
    const pin = uniqueHits(pins);
    const rest = finalHits.filter(
      (h) => h.kind !== "crs" && h.kind !== "lab" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/who is the head|head of\b/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/officer \/ branch-head names are not in this pack/i, 0.99),
      ...pinTitle(/bis headquarters — manak bhawan/i, 0.96),
      ...pinTitle(/contact \/ enquiry directory/i, 0.94),
    ]);
    const rest = finalHits.filter(
      (h) =>
        h.kind !== "standard" &&
        h.kind !== "hallmark" &&
        !/huid verification|verify a huid/i.test(h.title) &&
        !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/eco[\s-]?mark/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/eco mark is a separate bis scheme/i, 0.99),
      ...pinTitle(/know your standard — look up/i, 0.88),
    ]);
    const rest = finalHits.filter(
      (h) => h.kind !== "standard" && h.kind !== "hallmark" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/\bnws\b|\blrs\b|\bmeity\b|\bdpiit\b|\bcro\b/i.test(q) && !/lims\b/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/nws \/ lrs \/ unknown portal/i, 0.99),
      ...pinTitle(/isi mark scheme-i — apply on manak/i, 0.9),
      ...pinTitle(/know your standard — look up/i, 0.88),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/authorized indian representative|full form of air|\(air\)|\bnoc\b.{0,40}import/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/imported products — fmcs/i, 0.99),
      ...pinTitle(/fmcs \(foreign manufacturers/i, 0.92),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/stop[\s-]?marking|stop[\s-]?sale|non-conformance|\bncr\b|jurisprudence|penal provisions|counterfeiting the registration|compensation|legal mechanism|referencing section|mutual recognition|\bmra\b/i.test(q) || actSectionAsk) {
    const pin = uniqueHits([
      ...pinTitle(/stop marking \/ stop-sale \/ ncr/i, 0.99),
      ...pinTitle(/penalties for uncertified/i, 0.94),
      ...pinTitle(/fake bis \/ isi mark/i, 0.9),
      ...pinTitle(/factory inspection and surveillance/i, 0.88),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/genuine|check if the .{0,40} (is )?genuine|is (this|the) .{0,30} fake/i.test(q) && !hallmarkAsk) {
    const pin = uniqueHits([
      ...pinTitle(/fake bis \/ isi mark or logo/i, 0.99),
      ...pinTitle(/how to use the bis care app/i, 0.94),
      ...pinTitle(/know your standard — look up/i, 0.88),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/manakonline/i.test(q) && !hallmarkAsk && !isHallmarkSchemeMix(q, family)) {
    const pin = uniqueHits([
      ...pinTitle(/isi mark scheme-i — apply on manak/i, 0.99),
      ...pinTitle(/isi mark - product certification \(scheme-i\)/i, 0.9),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/\bnabl\b|17025/i.test(q)) {
    const pin = uniqueHits([...pinTitle(/nabl \/ iso\/iec 17025/i, 0.99), ...pinTitle(/live LIMS list/i, 0.9)]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/how to contact|contact bis|enquiry directory|bis for quer/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/bis headquarters — manak bhawan/i, 0.99),
      ...pinTitle(/contact \/ enquiry directory/i, 0.98),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/what (is|are) (an |the )?indian standards?\b|how many indian standards?/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/what are indian standards/i, 0.99),
      ...pinTitle(/how many indian standards are in this catalogue/i, 0.98),
      ...pinTitle(/what is bis\?|what is bis —/i, 0.9),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/process to develop|how an indian standard is developed|role of technical committees|bis role in standards/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/how an indian standard is developed/i, 0.99),
      ...pinTitle(/how iso and iec standards become/i, 0.9),
      ...pinTitle(/what is bis/i, 0.85),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/how is bis funded|bis funded|how is bis organised/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/how is bis organised \/ funded/i, 0.99),
      ...pinTitle(/bis headquarters — manak bhawan/i, 0.9),
    ]);
    finalHits = uniqueHits([...pin, ...finalHits.filter((h) => h.kind !== "standard")]);
  }

  if (/\bpenalt|uncertified products|selling uncertified/i.test(q)) {
    const pin = uniqueHits([
      ...pinTitle(/penalties for uncertified/i, 0.99),
      ...pinTitle(/fake bis \/ isi mark/i, 0.9),
      ...pinTitle(/consumer complaint/i, 0.85),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/food products?|name 3 important indian standards/i.test(q) && !family && !/\bagmark\b/i.test(q)) {
    const pin = uniqueHits([...pinTitle(/food product is numbers — name the food/i, 0.99), ...pinTitle(/know your standard — look up/i, 0.85)]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (family?.id === "paint" || (/\bpaints?\b|\bcoatings?\b/i.test(q) && !family)) {
    const pin = uniqueHits([...pinTitle(/paint \/ coatings — do not use is 383/i, 0.99), ...pinTitle(/know your standard — look up/i, 0.85)]);
    const rest = finalHits.filter(
      (h) => !/^IS\s*383\b/i.test(h.title) && h.kind !== "standard" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (/\bimported\b|\bdeemed certification\b|foreign manufacturer/i.test(q) && !ids.length) {
    const pin = uniqueHits([
      ...pinTitle(/imported products — fmcs/i, 0.99),
      ...pinTitle(/fmcs \(foreign manufacturers/i, 0.92),
      ...pinTitle(/products under compulsory certification/i, 0.85),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (
    !family &&
    !ids.length &&
    /\b(how to (get|apply|start)|documents? required|pre-?requisites?|factory inspection|surveillance|samples? (are )?tested|appeal|reappl|transfer.{0,24}facilit|rejected isi|non-compliance|start bis certif|isi licen[cs]e expires|track isi|certification be expedited|licenses? for multiple products|how long does (product )?testing take|testing take|accelerated testing|product fails testing|in-house and third-party|international test reports?)\b/i.test(
      q,
    )
  ) {
    const pin = uniqueHits([
      ...pinTitle(/factory inspection and surveillance/i, 0.97),
      ...pinTitle(/isi mark - product certification \(scheme-i\)/i, 0.94),
      ...pinTitle(/isi mark scheme-i — apply on manak/i, 0.93),
      ...pinTitle(/can one bis licence cover all varieties/i, 0.92),
      ...pinTitle(/what is the timeline for grant/i, 0.9),
    ]);
    const rest = finalHits.filter((h) => h.kind !== "standard" && h.kind !== "lab" && !pin.some((x) => x.title === h.title));
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (!family && !ids.length) {
    const official = finalHits.filter((h) => h.kind !== "standard" && h.kind !== "lab" && h.kind !== "crs");
    if (official.length) finalHits = uniqueHits(official);
    else {
      finalHits = uniqueHits([
        ...pinTitle(/what is bis/i, 0.9),
        ...pinTitle(/know your standard — look up/i, 0.88),
      ]);
    }
  }

  const speculative =
    /\b(blockchain|quantum|nano-?tech|nanotechnology|artificial intelligence|\bai\b|ai-generated|digital twin|firmware|geopolitical|climate change|child labou?r|supreme court|whistle-?blower|mass recall|harmonize|transition period|40%\s*content|virtual (simulation|test)|predictive maintenance|universal basic income|antitrust|vendetta|scientific fraud|dual standards?|iot enabled|partial compliance|contract manufacturing|merge|insurance)\b/i.test(
      q,
    );
  if (unknownTyped && !family) {
    const pin = uniqueHits([
      ...pinTitle(/is number not in this catalogue snapshot/i, 0.99),
      ...pinTitle(/know your standard — look up/i, 0.95),
      ...pinTitle(/hypothetical \/ policy scenario/i, 0.9),
    ]);
    finalHits = uniqueHits([...pin, ...finalHits.filter((h) => h.kind !== "standard" && h.kind !== "crs")]);
  } else if (knownTyped.length && noTableAsk) {
    const pin = uniqueHits([
      ...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.98),
      ...pinTitle(/know your standard — look up/i, 0.94),
    ]);
    const noted: EvidenceHit[] = [];
    for (const id of knownTyped) {
      const ch = exactIsChunk(id);
      if (!ch) continue;
      noted.push({
        ...toHit(ch, 0.35),
        body: `${ch.body}\nNOTE: Full clause text, sampling plans, and amendment transition days are not stored. Use Know Your Standard / e-Sale.`,
      });
    }
    const rest = finalHits.filter(
      (h) => h.kind !== "standard" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...noted, ...rest]);
  } else if (
    typedMismatch ||
    (knownTyped.length && family && !knownTyped.some((id) => family.is.includes(id)))
  ) {
    const pin = uniqueHits([...pinTitle(/is number vs product — do not mix catalogue rows/i, 0.97)]);
    const noted: EvidenceHit[] = [];
    for (const id of knownTyped) {
      const ch = exactIsChunk(id);
      if (!ch) continue;
      noted.push({
        ...toHit(ch, 0.99),
        body: `${ch.body}\nNOTE: The user named this IS. Say this title first. It is not the specification for the other product in the question. Do not say the catalogue is empty.`,
      });
    }
    const famHits = family
      ? finalHits.filter((h) => {
          const n = isNumbers(h.title)[0];
          return Boolean(n && family.is.includes(n));
        })
      : [];
    finalHits = uniqueHits([...noted, ...pin, ...famHits.slice(0, 1)]);
  } else if (
    speculative &&
    family?.scheme !== "crs" &&
    !((finalHits[0]?.score ?? 0) >= 0.96) &&
    !/care app|bis care|\bhuid\b/i.test(q)
  ) {
    const pin = uniqueHits([
      ...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.99),
      ...pinTitle(/know your standard — look up/i, 0.88),
      ...pinTitle(/contact \/ enquiry directory/i, 0.85),
    ]);
    const rest = finalHits.filter(
      (h) => h.kind !== "standard" && h.kind !== "crs" && !pin.some((x) => x.title === h.title),
    );
    finalHits = uniqueHits([...pin, ...rest]);
  }

  if (!family && !/\bcrs\b|compulsory registration|laptop|printer|power bank|webcam/i.test(q)) {
    finalHits = finalHits.filter((h) => h.kind !== "crs");
    if (!finalHits.length) {
      finalHits = uniqueHits([...pinTitle(/hypothetical \/ policy scenario/i, 0.9), ...pinTitle(/what is bis/i, 0.85)]);
    }
  }

  if (CLAUSE_ASK.test(q) && ids.length && !typedMismatch && !noTableAsk && !actSectionAsk) {
    const keepIs = finalHits.filter((h) => {
      const n = isNumbers(h.title);
      return n[0] && ids.includes(n[0]);
    });
    const portals = finalHits.filter((h) => /know your standard|e-sale|esale|download \/ purchase|purchase indian/i.test(`${h.title} ${h.body}`));
    finalHits = [...keepIs, ...portals.filter((p) => !keepIs.includes(p))];
  }

  const identifierLike =
    ids.length > 0 &&
    q.trim().length < 48 &&
    /^(?:indian\s+standards?\s+)?(?:is[\s/.-]*)?\d{3,5}(?:\s*[:/\-]\s*(?:19|20)\d{2}|\s+(?:19|20)\d{2})?$/i.test(q.trim());
  if (identifierLike) {
    const exact = finalHits.filter((h) => {
      const n = isNumbers(h.title)[0];
      return Boolean(n && ids.includes(n));
    });
    if (exact.length) {
      finalHits = uniqueHits([...exact, ...finalHits.filter((h) => h.kind !== "standard")]);
    }
  }

  if (
    !family &&
    !ids.length &&
    !((finalHits[0]?.score ?? 0) >= 0.9) &&
    !/care app|bis care|\bhuid\b|\blabs?\b|laborator|\blims\b/i.test(q)
  ) {
    finalHits = uniqueHits([
      ...pinTitle(/hypothetical \/ policy scenario — pack has no sop/i, 0.99),
      ...pinTitle(/know your standard — look up/i, 0.9),
      ...finalHits.filter((h) => h.kind !== "standard" && h.kind !== "lab" && h.kind !== "crs"),
    ]);
  }

  if (isLabCityQuery(q)) {
    const city = q.match(CITIES)?.[1]?.toLowerCase();
    if (city) {
      const needles = CITY_EXPAND[city] || [city];
      const cityLabs = uniqueHits(
        rag.chunks
          .filter((c) => c.kind === "lab" && needles.some((n) => `${c.title} ${c.body}`.toLowerCase().includes(n)))
          .map((c) => ({
            ...toHit(c, 0.97),
            body: `${c.body}\nNOTE: Group-1 list is a published name/city list. Do not claim this lab is accredited to test a named IS. Confirm live scope on BIS LIMS https://lims.bis.gov.in/home/search_is_number/ and the Group-1 PDF.`,
          })),
      );
      if (cityLabs.length) {
        const fam = family
          ? finalHits.filter((h) => {
              const n = isNumbers(h.title)[0];
              return Boolean(n && family.is.includes(n));
            })
          : [];
        const rest = finalHits.filter(
          (h) =>
            h.kind !== "lab" &&
            !fam.some((x) => x.title === h.title) &&
            !cityLabs.some((x) => x.title === h.title),
        );
        finalHits = uniqueHits(fam.length ? [fam[0], ...cityLabs, ...fam.slice(1), ...rest] : [...cityLabs, ...rest]);
      }
    }
  }

  const best = finalHits[0];
  const bestCov = best ? coverage(queryToks, `${best.title} ${best.body}`) : 0;
  const bestScore = best?.score ?? 0;
  const schemeKind =
    best && ["faq", "process", "hallmark", "product", "crs", "lab", "consumer", "link"].includes(best.kind);
  const pinnedOfficial = finalHits.some(
    (h) => h.score >= 0.9 && ["faq", "process", "link", "consumer", "hallmark", "product"].includes(h.kind),
  );
  const hasEvidence = Boolean(
    finalHits.length &&
      (family || pinnedOfficial || isLabCityQuery(q)
        ? true
        : ids.length
          ? bestScore >= 0.12
          : schemeKind
            ? bestScore >= 0.1
            : bestScore >= 0.14 || bestCov >= 0.3),
  );

  const ql = q.toLowerCase();
  let mode: Retrieval["mode"] = "general";
  if (
    !isHallmarkSchemeMix(q, family) &&
    (family?.scheme === "hallmark" || /hallmark|huid|gold|jewel/.test(ql) || finalHits.some((h) => h.kind === "hallmark"))
  )
    mode = "hallmarking";
  else if (finalHits.some((h) => h.kind === "standard" || h.kind === "crs" || h.kind === "product") || family)
    mode = "standards";

  const confidence: Retrieval["confidence"] = !hasEvidence
    ? "low"
    : family || bestScore >= 0.35
      ? "high"
      : bestScore >= 0.18
        ? "medium"
        : "low";

  return {
    query: q,
    hits: hasEvidence ? finalHits : [],
    mode,
    confidence,
    hasEvidence,
    grounding: hasEvidence ? "verified" : "refuse",
  };
}

export const RAG_VERIFIED = rag.verifiedAt || rag.verified;
export const RAG_CHUNK_COUNT = rag.chunks.length + catalogue.length;
