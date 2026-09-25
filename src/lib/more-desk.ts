import { glossIndic, matchProductFamily, shouldClarify, NON_JEWELLERY_PRODUCT } from "./product-playbook.ts";
import { moreCopy, type MoreCopy } from "./more-copy.ts";
import type { AppLang } from "./language.ts";
import { checkBrand, normalizeLicence } from "./verify-cert.ts";
import { deskUi, localVerdictTitle } from "./desk-ui.ts";

const HUID_URL = "https://huid.manakonline.in/MANAK/HallmarkingHomePage";
const KYS = "https://standards.bis.gov.in/website/know-your-standards";
const MANAK = "https://www.manakonline.in";
const CRS = "https://www.crsbis.in/BIS/about-crs.do";
const BIS = "https://www.bis.gov.in";
const COMPLAINT = "https://www.bis.gov.in/consumer-overview/online-complaint-registration/?lang=en";

export const MORE_URL = {
  huid: HUID_URL,
  kys: KYS,
  manak: MANAK,
  crs: CRS,
  bis: BIS,
  complaint: COMPLAINT,
} as const;

const HUID_BLOCK = /^(HUID|FAN|MARK|TEST|FAKE|GOLD|TOY|CEM|ISI|BIS|LAB|PIPE|BULB|SOAP|MILK)/;

export type MoreKind = "huid" | "hallmark" | "standards" | "certify" | "complaint" | "contact";
export type CertScheme = "isi" | "crs" | "fmcs";
export type HuidStatus = "empty" | "ok" | "bad" | "licence";
export type HuidCheck = { status: HuidStatus; code: string };

export type Fineness = { id: string; metal: "gold" | "silver" | "platinum"; tag: string };

export const FINENESS: Fineness[] = [
  { id: "995", metal: "gold", tag: "995" },
  { id: "958", metal: "gold", tag: "23K" },
  { id: "916", metal: "gold", tag: "22K" },
  { id: "875", metal: "gold", tag: "21K" },
  { id: "750", metal: "gold", tag: "18K" },
  { id: "585", metal: "gold", tag: "14K" },
  { id: "375", metal: "gold", tag: "9K" },
  { id: "999", metal: "silver", tag: "999" },
  { id: "970", metal: "silver", tag: "970" },
  { id: "925", metal: "silver", tag: "925" },
  { id: "900", metal: "silver", tag: "900" },
  { id: "835", metal: "silver", tag: "835" },
  { id: "800", metal: "silver", tag: "800" },
  { id: "950", metal: "platinum", tag: "950" },
  { id: "pt900", metal: "platinum", tag: "900" },
  { id: "850", metal: "platinum", tag: "850" },
];

const GRADE_WORD: Record<string, string> = {
  "995": "995",
  "958": "958",
  "916": "916",
  "875": "875",
  "750": "750",
  "585": "585",
  "375": "375",
  "999": "999",
  "970": "970",
  "925": "925",
  "900": "900",
  "835": "835",
  "800": "800",
  "950": "950",
  "850": "850",
  "23k": "958",
  "22k": "916",
  "21k": "875",
  "18k": "750",
  "14k": "585",
  "9k": "375",
};

export function prepQuery(raw: string): string {
  return glossIndic(raw)
    .replace(/जाँच|जांच|जांचो|चेक|तपास|तपासा/g, " verify ")
    .replace(/कैरेट|कैरट|कॅरेट|केरेट/g, " carat ")
    .replace(/शुद्धता/g, " fineness ")
    .replace(/संपर्क|सम्पर्क/g, " contact us ")
    .replace(/कैसे|केसे/g, " how to ")
    .replace(/जौहरी|ज्वेलर/g, " jeweller ")
    .replace(/रजिस्ट्रेशन|रजिस्टर/g, " registration ")
    .replace(/मानक भवन/g, " manak bhavan ")
    .replace(/\bshikayat\b/gi, " complaint ")
    .replace(/\s+/g, " ")
    .trim();
}

function digitsToAscii(text: string): string {
  const maps = ["०१२३४५६७८९", "০১২৩৪৫৬৭৮৯", "੦੧੨੩੪੫੬੭੮੯", "૦૧૨૩૪૫૬૭૮૯", "୦୧୨୩୪୫୬୭୮୯", "௦௧௨௩௪௫௬௭௮௯", "౦౧౨౩౪౫౬౭౮౯", "೦೧೨೩೪೫೬೭೮೯", "൦൧൨൩൪൫൬൭൮൯"];
  let out = text;
  for (const digits of maps) {
    out = out.replace(new RegExp(`[${digits}]`, "g"), (d) => String(digits.indexOf(d)));
  }
  return out;
}

export function huidToken(raw: string): string {
  const text = digitsToAscii(raw).toUpperCase();
  const tokens = text.split(/[^A-Z0-9]+/).filter((part) => part && part !== "HUID");
  for (const token of tokens) {
    if (token.length === 6 && /[A-Z]/.test(token) && /\d/.test(token)) return token;
  }
  return "";
}

export function checkHuid(raw: string): HuidCheck {
  const text = normalizeLicence(digitsToAscii(raw));
  if (!text) return { status: "empty", code: "" };
  if (/^CM\/L-\d{6,8}$/.test(text) || /^R-\d{6,12}$/.test(text)) return { status: "licence", code: text };
  const token = huidToken(raw);
  if (token) {
    if (HUID_BLOCK.test(token)) return { status: "bad", code: token };
    return { status: "ok", code: token };
  }
  const compact = text.replace(/[^A-Z0-9]/g, "");
  return { status: "bad", code: compact.slice(0, 16) };
}

export function metalWord(copy: MoreCopy, metal: Fineness["metal"]): string {
  if (metal === "gold") return copy.gold;
  if (metal === "silver") return copy.silver;
  return copy.platinum;
}

export function gradeLine(copy: MoreCopy, grade: Fineness): string {
  return copy.gradeLine
    .replace("{tag}", grade.tag)
    .replace("{metal}", metalWord(copy, grade.metal))
    .replace("{id}", grade.id === "pt900" ? "900" : grade.id);
}

export function findHallmark(raw: string): { grade: Fineness | null; ambiguous900: boolean } {
  const q = prepQuery(raw).toLowerCase();
  const platinum = /\bplatinum\b|प्लेटिन|প্লাটিনা|பிளாட்டி|ప్లాటి|प्लॅटि|પ્લેટિ|ಪ್ಲಾಟಿ|പ്ലാറ്റി|ਪਲੈਟ|پلاٹی|ପ୍ଲାଟି/.test(q);
  const silver = /\bsilver\b|चाँदी|চান্दी|வெள்ளி|వెండి|चांदी|ચાંદી|ಬೆಳ್ಳಿ|വെള്ളി|ਚਾਂਦੀ|چاندی|ରୂପା/.test(raw + q);
  let id = "";
  const karat = q.match(/\b(23|22|21|18|14|9)\s*(?:k|kt|carat|karat)\b/);
  if (karat) id = GRADE_WORD[`${karat[1]}k`] || "";
  if (!id) {
    const num = q.match(/\b(995|958|916|875|750|585|375|999|970|925|900|835|800|950|850)\b/);
    if (num) id = num[1];
  }
  if (!id) return { grade: null, ambiguous900: false };
  if (id === "900") {
    const grade = FINENESS.find((row) => row.id === (platinum && !silver ? "pt900" : "900")) || null;
    return { grade, ambiguous900: !platinum && !silver };
  }
  const grade = FINENESS.find((row) => row.id === id) || null;
  return { grade, ambiguous900: false };
}

export function certScheme(raw: string): CertScheme {
  const q = prepQuery(raw);
  if (/\bfmcs\b|foreign manufacturers?/i.test(q)) return "fmcs";
  if (/\bcrs\b|scheme-?\s*(ii|2)\b|registration scheme/i.test(q)) return "crs";
  if (/\bisi\b|scheme-?\s*(i|1)\b/i.test(q)) return "isi";
  const family = matchProductFamily(raw);
  if (family?.scheme === "crs") return "crs";
  return "isi";
}

function hasIsNumber(original: string, q: string): boolean {
  if (/\bIS[\s/.:-]*\d{3,6}\b/.test(original) || /\bIS[\s/.:-]*\d{3,6}\b/.test(q)) return true;
  const lower = original.match(/\bis[\s/.:-]*(\d{3,6})\b/);
  if (!lower) return false;
  const fineness = /^(995|958|916|875|750|585|375|999|970|925|900|835|800|950|850)$/.test(lower[1]);
  if (fineness && !/\b(standard|isi)\b/i.test(original)) return false;
  return true;
}

function feeOrClause(q: string): boolean {
  return /\b(clause|fee|fees|timeline|penalty|marking fee)\b/i.test(q);
}

export function moreKind(raw: string): MoreKind | null {
  const original = raw.trim();
  if (!original || original.length > 600) return null;
  const q = prepQuery(original);
  if (!q) return null;
  if (feeOrClause(q) && !/\bcomplain/i.test(q)) return null;
  if (hasIsNumber(original, q) && !/\bhuid\b/i.test(q)) return null;

  if (/\b(complain\w*|grievance|fake mark|counterfeit|misuse of (the )?mark)\b/i.test(q)) return "complaint";
  if (/\b(contact us|bis address|head office|manak bhavan|phone number of bis)\b/i.test(q)) return "contact";

  const licence = normalizeLicence(digitsToAscii(original));
  if (/^CM\/L-\d/.test(licence) || /^R-\d/.test(licence)) return null;

  const token = huidToken(original);
  if (token) return "huid";
  if (/\bhuid\b/i.test(q) && (/\b(verify|check|what|how|status|code)\b/i.test(q) || q.length < 80)) return "huid";

  if (/\b(jeweller|ahc)\b/i.test(q) && /\b(regist\w*|licen[cs]e|apply|application)\b/i.test(q) && !/\bisi\b/i.test(q)) {
    return "hallmark";
  }

  const hallmarkish =
    !NON_JEWELLERY_PRODUCT.test(q) &&
    (/\b(22|18|14|9|23|21)\s*(?:k|kt|carat|karat)\b/i.test(q) ||
      (/\b(995|958|916|875|750|585|375|999|970|925|835|800|950|850)\b/.test(q) &&
        (/\b(hallmark|gold|silver|platinum|purity|fineness|carat|karat|jewell)/i.test(q) || q.length < 32)) ||
      (/\b900\b/.test(q) && /\b(hallmark|silver|platinum|purity|fineness)\b/i.test(q)) ||
      (/\bhallmark\b/i.test(q) && q.length < 140 && !/\b(cement|laptop|helmet)\b/i.test(q)));
  if (hallmarkish && !/\b(how (do|to)|process|steps|apply)\b/i.test(q)) return "hallmark";
  if (/\b(how (do|to|can)|process|steps|apply|application)\b/i.test(q) && /\b(hallmark|jeweller|ahc)\b/i.test(q) && !/\bisi\b/i.test(q)) {
    return "hallmark";
  }

  if (
    (/\b(how (do|to|can)|process|steps|apply|application)\b/i.test(q) && /\b(isi|crs|fmcs|certif\w*|scheme)\b/i.test(q)) ||
    /\bcertification process\b/i.test(q)
  ) {
    if (!/\b(isi|crs|fmcs)\b/i.test(q)) {
      const family = matchProductFamily(original);
      if (family?.scheme === "hallmark") return "hallmark";
    }
    return "certify";
  }

  if (
    /\b(how (do|to|can) (i |we )?(find|look up|search)|where (do|can) i find|standards? finder|find (the |an )?(indian )?standards?|which indian standard|what indian standard|applicable indian standard|indian standard for|which standard (for|applies)|what standard applies)\b/i.test(
      q,
    )
  ) {
    return "standards";
  }
  const named = matchProductFamily(original);
  if (
    named &&
    /\bstandards?\b/i.test(q) &&
    !/\b(how (do|to|can)|process|steps|apply|application|fee|fees|complaint|licen[cs]e)\b/i.test(q)
  ) {
    return "standards";
  }
  return null;
}

function tags(title: string, url: string, follow: string, confidence: string, mode: string): string {
  return `[SOURCE] ${title} | portal | 2026-09-25 | ${url}\n[FOLLOW_UP] ${follow}\n[META] ${confidence} | ${mode}`;
}

function numbered(lines: string[]): string[] {
  return lines.filter(Boolean).map((line, index) => `${index + 1}. ${line}`);
}

function fill(template: string, code: string): string {
  return template.replaceAll("{code}", code);
}

export function moreReply(raw: string, language: AppLang = "en"): string | null {
  const kind = moreKind(raw);
  if (!kind) return null;
  const copy = moreCopy(language);
  if (kind === "huid") return huidReply(raw, copy);
  if (kind === "hallmark") return hallmarkReply(raw, copy);
  if (kind === "standards") return standardsReply(raw, language, copy);
  if (kind === "certify") return certifyReply(raw, copy);
  if (kind === "complaint") return complaintReply(copy);
  return contactReply(copy);
}

function huidReply(raw: string, copy: MoreCopy): string {
  const checked = checkHuid(raw);
  const lines: string[] = [];
  if (checked.status === "ok") lines.push(fill(copy.huidOk, checked.code));
  else if (checked.status === "licence") lines.push(copy.huidLicence);
  else if (checked.status === "bad") lines.push(checked.code ? `${copy.huidBad} (${checked.code})` : copy.huidBad);
  else lines.push(copy.huidEmpty);
  lines.push("");
  lines.push(...numbered(copy.huidSteps));
  lines.push("");
  lines.push(copy.notLive);
  lines.push("");
  lines.push(tags(copy.openHuid, HUID_URL, copy.huid, checked.status === "ok" ? "medium" : "low", "hallmarking"));
  return lines.join("\n");
}

function hallmarkReply(raw: string, copy: MoreCopy): string {
  const found = findHallmark(raw);
  const q = prepQuery(raw);
  const applying = /\b(how (do|to|can)|process|steps|apply|application|regist)/i.test(q);
  const jeweller = /\b(jeweller|ahc)\b/i.test(q) || /\b(registration|licence|license)\b/i.test(q);
  const lines: string[] = [];
  if (found.grade) {
    lines.push(gradeLine(copy, found.grade));
    if (found.ambiguous900) lines.push(copy.both900);
  } else if (applying || jeweller) {
    lines.push(copy.hmJeweller);
  } else {
    lines.push(copy.hmMiss);
  }
  lines.push("");
  const steps = [...copy.hmSteps];
  if (jeweller && found.grade) steps.push(copy.hmJeweller);
  lines.push(...numbered(steps));
  lines.push("");
  lines.push(copy.notLive);
  lines.push("");
  lines.push(tags(copy.openHuid, HUID_URL, copy.hallmark, "medium", "hallmarking"));
  return lines.join("\n");
}

function standardsReply(raw: string, language: AppLang, copy: MoreCopy): string {
  const family = matchProductFamily(raw);
  const verdict = family ? checkBrand(raw) : null;
  const clarify = shouldClarify(raw);
  const lines: string[] = [];
  if (family && clarify) {
    lines.push(copy.stClarify);
    if (verdict?.marks.length) lines.push(`${deskUi(language).marks}: ${verdict.marks.join(", ")}.`);
  } else if (verdict && verdict.marks.length) {
    lines.push(localVerdictTitle(language, verdict));
    lines.push(copy.stHit);
    lines.push(`${deskUi(language).marks}: ${verdict.marks.join(", ")}.`);
  } else {
    lines.push(copy.stMiss);
  }
  lines.push("");
  lines.push(...numbered(copy.stSteps));
  lines.push("");
  lines.push(tags(copy.stOpen, KYS, copy.standards, verdict?.marks.length ? "medium" : "low", "standards"));
  return lines.join("\n");
}

function certifyReply(raw: string, copy: MoreCopy): string {
  const scheme = certScheme(raw);
  const steps = scheme === "crs" ? copy.crsSteps : scheme === "fmcs" ? copy.fmcsSteps : copy.isiSteps;
  const title = scheme === "crs" ? copy.crs : scheme === "fmcs" ? copy.fmcs : copy.isi;
  const url = scheme === "crs" ? CRS : scheme === "fmcs" ? BIS : MANAK;
  const label = scheme === "crs" ? copy.openCrs : scheme === "fmcs" ? copy.openBis : copy.openManak;
  const family = matchProductFamily(raw);
  const lines = [title];
  if (family?.is.length) lines.push(family.is.map((n) => `IS ${n}`).join(", "));
  lines.push("");
  lines.push(...numbered(steps));
  lines.push("");
  lines.push(tags(label, url, copy.certify, "medium", "standards"));
  return lines.join("\n");
}

function complaintReply(copy: MoreCopy): string {
  const lines = [copy.coLede, "", ...numbered(copy.coSteps), "", tags(copy.openComplaint, COMPLAINT, copy.complaint, "high", "general")];
  return lines.join("\n");
}

function contactReply(copy: MoreCopy): string {
  const lines = [copy.contactTitle, "", ...numbered(copy.contactSteps), "", tags(copy.openBis, BIS, copy.contact, "high", "general")];
  return lines.join("\n");
}
