import type { AppLang } from "./language.ts";
import { NEAR_KM, areaMapUrl, cityToPin, pinCentroid, rankLabs, type RankedLab } from "./labs.ts";
import { readinessSheet } from "./readiness.ts";
import { checkBrand, checkLicence, type VerifyVerdict } from "./verify-cert.ts";
import { chromeCopy } from "./chrome-copy.ts";
import { deskUi, localFactLabel, localOfficial, localVerdictTitle } from "./desk-ui.ts";
import { glossIndic } from "./product-playbook.ts";

export type DeskKind = "verify" | "labs" | "file";

const FILE_CUE = /\b(product file|still open|open points|before (i|we) apply|to my catalogue)\b/i;
const LAB_CUE =
  /\b(nearest|nearby|near me|closest|around me|near this|my location|current location)\b.{0,48}\b(labs?|laborator(?:y|ies))\b|\b(labs?|laborator(?:y|ies))\b.{0,32}\b(near|nearby|closest|around|pin|pincode|pin code|my location|this location)\b|\bfind (me )?(a )?(testing )?(lab|labs|laboratory)\b(?!\s+clause)|\bpin(?:\s*code)?\b.{0,30}\b(labs?|laborator(?:y|ies))\b/i;
const VERIFY_CUE = /\b(verify|check)(?:\s+(?:this|my|the))?(?:\s+(?:mark|number|licence|license|product|huid))?\s+\S+/i;
const LICENCE = /\bCM\/?L[-\s]?\d{6,8}\b|\bR-\d{6,12}\b/i;
const PIN = /(?<!IS[\s/.-]*)\b([1-9][0-9]{5})\b/i;

function tags(title: string, type: string, url: string, follow: string, confidence: string, mode: string): string {
  return `[SOURCE] ${title} | ${type} | 2026-09-25 | ${url}\n[FOLLOW_UP] ${follow}\n[META] ${confidence} | ${mode}`;
}

function link(label: string, url: string): string {
  return `[${label}](${url})`;
}

function payload(query: string): string {
  return query
    .replace(/\bproduct file\b/gi, " ")
    .replace(/\b(still open|open points|before (?:i|we) apply)\b/gi, " ")
    .replace(/^\s*(?:please\s+)?(?:verify|check)\s+(?:this|my|the\s+)?(?:mark|number|licence|license|product|huid\s+)?/i, " ")
    .replace(/\b(for|of|on|the|a|an|my|this)\b/gi, " ")
    .replace(LICENCE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function deskKind(query: string): DeskKind | null {
  const text = query.trim();
  if (!text) return null;
  if (FILE_CUE.test(text)) return "file";
  if (isLabAsk(text)) return "labs";
  if (isVerifyAsk(text)) return "verify";
  return null;
}

/** Browser location is asked only for a lab search that has no PIN and no known city. */
export function needsDeviceLocation(query: string): boolean {
  if (deskKind(query) !== "labs") return false;
  const q = glossIndic(query);
  if (PIN.test(q) || cityToPin(q)) return false;
  return true;
}

function isLabAsk(text: string): boolean {
  const q = glossIndic(text);
  const placed = Boolean(PIN.test(q) || cityToPin(q));
  if (/\b(clause|meaning|what is|process|procedure)\b/i.test(q) && !/\b(near|nearby|nearest|pin)\b/i.test(q) && !placed) return false;
  if (/^\s*how\b/i.test(q) && !placed && !/\b(near|nearby|nearest)\b/i.test(q)) return false;
  if (LAB_CUE.test(q) || LAB_CUE.test(text)) return true;
  return placed && /\b(labs?|laborator(?:y|ies))\b/i.test(q);
}

function isVerifyAsk(text: string): boolean {
  if (LICENCE.test(text)) return true;
  if (/^\s*how\b/i.test(text)) return false;
  if (/\b(process|procedure|steps)\b/i.test(text)) return false;
  return VERIFY_CUE.test(text);
}

/** Same board the labs page draws: embed map, nearby list, then farther. Null until a PIN or known city is in the query. */
export type LabBoard = {
  origin: { lat: number; lng: number; label: string };
  nearby: RankedLab[];
  farther: RankedLab[];
  mapUrl: string;
};

export function labsFinderResult(query: string): LabBoard | null {
  if (deskKind(query) !== "labs") return null;
  const q = glossIndic(query);
  const pin = query.match(PIN)?.[1] ?? q.match(PIN)?.[1] ?? cityToPin(q) ?? "";
  const origin = pin ? pinCentroid(pin) : null;
  if (!origin) return null;
  const product = payload(query).replace(pin, "").trim();
  const ranked = rankLabs(origin.lat, origin.lng, product);
  return {
    origin,
    nearby: ranked.filter((lab) => lab.km <= NEAR_KM),
    farther: ranked.filter((lab) => lab.km > NEAR_KM).slice(0, 4),
    mapUrl: areaMapUrl(origin.lat, origin.lng, `${origin.label} ${pin}`, product),
  };
}

export function deskReply(query: string, language: AppLang = "en"): string | null {
  const kind = deskKind(query);
  if (!kind) return null;
  if (kind === "verify") return verifyText(query, language);
  if (kind === "labs") return labsText(query, language);
  return fileText(query, language);
}

function verifyText(query: string, language: AppLang): string {
  const ui = deskUi(language);
  const licence = query.match(LICENCE)?.[0];
  if (licence) return licencePoints(checkLicence(licence), language);
  const name = payload(query);
  if (name.length < 2) {
    return [
      ui.verifyStart,
      "",
      `- ${ui.isiEg}`,
      `- ${ui.crsEg}`,
      `- ${ui.huidEg}`,
      "",
      tags(ui.openManak, "portal", "https://www.manakonline.in", chromeCopy(language).verify, "low", "hallmarking"),
    ].join("\n");
  }
  return brandPoints(checkBrand(name), language);
}

function licencePoints(verdict: VerifyVerdict, language: AppLang): string {
  const ui = deskUi(language);
  const mark = verdict.marks[0] || "—";
  const lines = [`**${mark}**`, ""];
  if (verdict.scheme === "ISI · Scheme-I") {
    lines.push(`- ${ui.isiShape}`);
    lines.push(`- ${ui.isiLive}`);
  } else if (verdict.scheme === "CRS · Scheme-II") {
    lines.push(`- ${ui.crsShape}`);
    lines.push(`- ${ui.crsNot}`);
    lines.push(`- ${ui.crsLive}`);
  } else if (verdict.scheme === "Hallmark · HUID") {
    lines.push(`- ${ui.huidShape}`);
    lines.push(`- ${ui.huidNot}`);
  } else {
    lines.push(`- ${ui.noShape}`);
    lines.push(`- ${ui.noShape2}`);
  }
  lines.push(`- ${ui.official}: ${link(localOfficial(language, verdict.officialLabel), verdict.officialUrl)}.`);
  lines.push("");
  lines.push(tags(localOfficial(language, verdict.officialLabel), "portal", verdict.officialUrl, chromeCopy(language).verify, verdict.confidence === "none" ? "low" : verdict.confidence, "hallmarking"));
  return lines.join("\n");
}

function brandPoints(verdict: VerifyVerdict, language: AppLang): string {
  const ui = deskUi(language);
  const lines = [`**${localVerdictTitle(language, verdict)}**`, ""];
  if (verdict.scheme) lines.push(`- ${ui.scheme}: ${verdict.scheme}.`);
  if (verdict.marks.length) lines.push(`- ${ui.marks}: ${verdict.marks.join(", ")}.`);
  if (verdict.status === "brand-hit") {
    lines.push(`- ${ui.hit1}`);
    lines.push(`- ${ui.hit2}`);
  } else if (verdict.status === "unclear") {
    lines.push(`- ${ui.unclear1}`);
    lines.push(`- ${ui.unclear2}`);
  } else {
    lines.push(`- ${ui.miss1}`);
    lines.push(`- ${ui.miss2}`);
  }
  lines.push(`- ${ui.official}: ${link(localOfficial(language, verdict.officialLabel), verdict.officialUrl)}.`);
  lines.push("");
  lines.push(tags(localOfficial(language, verdict.officialLabel), "portal", verdict.officialUrl, chromeCopy(language).verify, verdict.confidence === "none" ? "low" : verdict.confidence, "standards"));
  return lines.join("\n");
}

function labsText(query: string, language: AppLang): string {
  const ui = deskUi(language);
  const board = labsFinderResult(query);
  const lims = "https://lims.bis.gov.in/home/search_is_number/";
  if (!board) {
    return [
      ui.pinNeed,
      "",
      `- ${ui.pinExample}`,
      `- ${ui.pinCity}`,
      `- ${ui.limsLine} ${link(ui.openLims, lims)}.`,
      "",
      tags("BIS LIMS", "portal", lims, chromeCopy(language).labs, "low", "general"),
    ].join("\n");
  }
  const pin = query.match(PIN)?.[1] ?? cityToPin(glossIndic(query)) ?? "";
  const closest = board.nearby[0] || board.farther[0];
  if (!closest) {
    return [
      ui.pinNeed,
      "",
      tags("BIS LIMS", "portal", lims, chromeCopy(language).labs, "low", "general"),
    ].join("\n");
  }
  const place = `${board.origin.label} (${pin})`;
  const head =
    language === "en"
      ? board.nearby.length
        ? `Closest laboratory to ${place}: ${closest.name}, ${closest.km} km.`
        : `No listed laboratory is within ${NEAR_KM} km of ${place}. Closest: ${closest.name}, ${closest.km} km.`
      : board.nearby.length
        ? `${ui.nearYes} ${NEAR_KM} km · ${place}. ${closest.name}, ${closest.km} km.`
        : `${ui.nearNo} ${NEAR_KM} km · ${place}. ${closest.name}, ${closest.km} km.`;
  const lines = [head, ""];
  const shown = board.nearby.length ? board.nearby.slice(0, 3) : [closest];
  for (const lab of shown) {
    const kind = lab.confidence === "high" ? ui.bisLab : ui.cityList;
    lines.push(`- ${lab.name} — ${lab.km} km. ${kind}.`);
  }
  lines.push(`- ${ui.scopeLine} ${link(ui.openLims, lims)}.`);
  lines.push("");
  lines.push(tags("BIS LIMS", "portal", lims, chromeCopy(language).labs, board.nearby.some((lab) => lab.confidence === "high") ? "high" : "low", "general"));
  return lines.join("\n");
}

function fileText(query: string, language: AppLang): string {
  const ui = deskUi(language);
  const licenceRaw = query.match(LICENCE)?.[0] ?? "";
  const name = payload(query);
  const kys = "https://standards.bis.gov.in/website/know-your-standards";
  if (name.length < 2 && !licenceRaw) {
    return [
      ui.fileNeed,
      "",
      `- ${ui.fileExample}`,
      `- ${ui.fileNoScore}`,
      "",
      tags(ui.openKys, "portal", kys, chromeCopy(language).file, "low", "standards"),
    ].join("\n");
  }
  const sheet = readinessSheet(name || licenceRaw, licenceRaw);
  const lines = [`**${localVerdictTitle(language, sheet.verdict)}**`, ""];
  if (sheet.verdict.scheme) lines.push(`- ${ui.scheme}: ${sheet.verdict.scheme}.`);
  if (sheet.verdict.marks.length) lines.push(`- ${ui.marks}: ${sheet.verdict.marks.join(", ")}.`);
  if (sheet.stated.length) {
    lines.push(`- ${ui.noted}: ${sheet.stated.map((fact) => `${localFactLabel(language, fact.label)} ${fact.value}`).join(", ")}.`);
  }
  if (!sheet.licence) lines.push(`- ${ui.noLicence}`);
  else if (sheet.licence.status === "format-ok") lines.push(`- ${sheet.licence.marks[0]} ${ui.shapeOk}`);
  else lines.push(`- ${ui.shapeBad}`);
  lines.push(`- ${ui.noPercent}`);
  lines.push(`- ${ui.official}: ${link(localOfficial(language, sheet.verdict.officialLabel), sheet.verdict.officialUrl)}.`);
  const extra =
    sheet.licence && sheet.licence.officialUrl !== sheet.verdict.officialUrl
      ? `\n[SOURCE] ${localOfficial(language, sheet.licence.officialLabel)} | portal | 2026-09-25 | ${sheet.licence.officialUrl}`
      : "";
  lines.push("");
  lines.push(tags(localOfficial(language, sheet.verdict.officialLabel), "portal", sheet.verdict.officialUrl, chromeCopy(language).file, "low", "standards") + extra);
  return lines.join("\n");
}
