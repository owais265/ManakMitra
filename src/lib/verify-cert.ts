import { listProductFamilies, matchProductFamily, shouldClarify, type SchemeKind } from "./product-playbook.ts";

export type VerifyMode = "licence" | "brand" | "photo";

export type VerifyStatus = "invalid" | "format-ok" | "brand-hit" | "unclear" | "not-found" | "unreadable";

export type VerifyVerdict = {
  status: VerifyStatus;
  title: string;
  detail: string;
  scheme: string | null;
  marks: string[];
  officialUrl: string;
  officialLabel: string;
  confidence: "high" | "low" | "none";
};

const KYS = "https://standards.bis.gov.in/website/know-your-standards";
const MANAK = "https://www.manakonline.in";
const CRS = "https://www.crsbis.in/BIS/about-crs.do";
const HUID = "https://huid.manakonline.in/MANAK/HallmarkingHomePage";

const HINDI_DIGITS = "०१२३४५६७८९";

const NOT_A_GRANT =
  "This is not a BIS grant, refusal, or live register lookup. Confirm the mark on the official portal before you buy, ship, or label.";

function schemeLabel(scheme: SchemeKind | string | null | undefined): string | null {
  if (scheme === "isi" || scheme === "ISI · Scheme-I") return "ISI · Scheme-I";
  if (scheme === "crs" || scheme === "CRS · Scheme-II") return "CRS · Scheme-II";
  if (scheme === "hallmark" || scheme === "Hallmark · HUID") return "Hallmark · HUID";
  return null;
}

function familyForIs(num: string) {
  return listProductFamilies().find((family) => family.is.includes(num)) ?? null;
}

const HUID_BLOCK = /^(HUID|FAN|MARK|TEST|FAKE|GOLD|TOY|CEM|ISI|BIS|LAB|PIPE|BULB|SOAP|MILK)/;

export function normalizeLicence(raw: string): string {
  let text = raw.normalize("NFKC").trim().slice(0, 80);
  text = text.replace(/[०-९]/g, (d) => String(HINDI_DIGITS.indexOf(d)));
  text = text.toUpperCase().replace(/\s+/g, "");
  text = text.replace(/^C\/?M[-/]?L[-/]?/, "CM/L-");
  text = text.replace(/^CML-?/, "CM/L-");
  if (/^R\d{6,12}$/.test(text)) text = `R-${text.slice(1)}`;
  return text;
}

export function checkLicence(raw: string): VerifyVerdict {
  const text = normalizeLicence(raw);
  if (!text) {
    return {
      status: "invalid",
      title: "Enter a licence or registration number",
      detail: "Use the number printed with the mark. ISI factory licences look like CM/L-1234567. CRS registrations look like R-41000001. A jewellery HUID is 6 characters.",
      scheme: null,
      marks: [],
      officialUrl: MANAK,
      officialLabel: "Open MANAK",
      confidence: "none",
    };
  }

  const isi = /^CM\/L-(\d{6,8})$/.exec(text);
  if (isi) {
    return {
      status: "format-ok",
      title: `${text} · ISI licence shape`,
      detail: `${text} matches a Scheme-I (ISI) licence shape. ManakMitra does not hold the live BIS licensee list, so this is not a pass or a fail. ${NOT_A_GRANT}`,
      scheme: "ISI · Scheme-I",
      marks: [text],
      officialUrl: MANAK,
      officialLabel: "Check on MANAK",
      confidence: "high",
    };
  }

  const crs = /^R-(\d{6,12})$/.exec(text);
  if (crs) {
    return {
      status: "format-ok",
      title: `${text} · CRS registration shape`,
      detail: `${text} matches a Scheme-II (CRS) registration shape, not an ISI CM/L number and not a jewellery HUID. ${NOT_A_GRANT}`,
      scheme: "CRS · Scheme-II",
      marks: [text],
      officialUrl: CRS,
      officialLabel: "Open CRS",
      confidence: "high",
    };
  }

  if (/^[A-Z0-9]{6}$/.test(text) && /[A-Z]/.test(text) && /\d/.test(text) && !text.startsWith("CM") && !HUID_BLOCK.test(text)) {
    return {
      status: "format-ok",
      title: `${text} · possible jewellery HUID`,
      detail: `${text} has the 6-character shape of a hallmark unique ID. It is not a factory licence, and this desk cannot see the BIS CARE register. ${NOT_A_GRANT}`,
      scheme: "Hallmark · HUID",
      marks: [text],
      officialUrl: HUID,
      officialLabel: "Open hallmarking",
      confidence: "low",
    };
  }

  return {
    status: "invalid",
    title: "That number does not match a known mark",
    detail: `${text} is not a CM/L licence (6–8 digits), an R- registration (6–12 digits), or a 6-character HUID. Check the packing again. Do not treat a lookalike as certified.`,
    scheme: null,
    marks: [text],
    officialUrl: MANAK,
    officialLabel: "Open MANAK",
    confidence: "none",
  };
}

export function checkBrand(raw: string): VerifyVerdict {
  const query = raw.normalize("NFKC").trim().slice(0, 160);
  if (query.length < 2) {
    return {
      status: "invalid",
      title: "Enter a product or brand",
      detail: "Example: cement, ceiling fan, or a packaged name plus the product. A brand hit is the standard route, not proof that the company holds a licence.",
      scheme: null,
      marks: [],
      officialUrl: KYS,
      officialLabel: "Know Your Standard",
      confidence: "none",
    };
  }

  const isHit = /\bIS[\s/.-]*(\d{3,6})\b/i.exec(query);
  const family = matchProductFamily(query) ?? (isHit ? familyForIs(isHit[1]) : null);
  const clarify = shouldClarify(query);
  const scheme = schemeLabel(family?.scheme);

  if (clarify && !isHit) {
    return {
      status: "unclear",
      title: family ? `${family.id.replace(/-/g, " ")} · one detail missing` : "One detail is still missing",
      detail: clarify,
      scheme,
      marks: family?.is.map((n) => `IS ${n}`) ?? [],
      officialUrl: KYS,
      officialLabel: "Know Your Standard",
      confidence: "low",
    };
  }

  const marks = [
    ...(isHit ? [`IS ${isHit[1]}`] : []),
    ...(family?.is.map((n) => `IS ${n}`) ?? []),
  ].filter((mark, index, all) => all.indexOf(mark) === index);

  if (!marks.length) {
    if (family) {
      return {
        status: "unclear",
        title: "The family is known, the standard is not pinned",
        detail: family.disambiguate || "This product family is in the catalogue, but no IS number is pinned here. Confirm the live title on Know Your Standard. A name match is not a licence.",
        scheme: schemeLabel(family.scheme),
        marks: [],
        officialUrl: KYS,
        officialLabel: "Know Your Standard",
        confidence: "low",
      };
    }
    return {
      status: "not-found",
      title: "No catalogue pin for that name",
      detail: "The public pack has no pinned standard for this brand or product. That is not a finding of non-compliance. Look the product up on Know Your Standard, then check the licence on MANAK or CRS.",
      scheme: null,
      marks: [],
      officialUrl: KYS,
      officialLabel: "Know Your Standard",
      confidence: "none",
    };
  }

  const labelled = schemeLabel(family?.scheme);

  return {
    status: "brand-hit",
    title: `${marks[0]} · ${family ? family.id.replace(/-/g, " ") : "named standard"}`,
    detail: `${query} maps to ${marks.join(", ")}${labelled ? ` under ${labelled}` : ""}. A matching standard does not mean this brand is licensed. Read the CM/L, R-number, or HUID on the product and check that number on the official portal. ${NOT_A_GRANT}`,
    scheme: labelled,
    marks,
    officialUrl: labelled === "CRS · Scheme-II" ? CRS : labelled === "Hallmark · HUID" ? HUID : labelled === "ISI · Scheme-I" ? MANAK : KYS,
    officialLabel: labelled === "CRS · Scheme-II" ? "Open CRS" : labelled === "Hallmark · HUID" ? "Open hallmarking" : labelled === "ISI · Scheme-I" ? "Check on MANAK" : "Know Your Standard",
    confidence: "low",
  };
}

export function verdictFromPhotoRead(read: { licence?: string | null; isNumber?: string | null; brand?: string | null }): VerifyVerdict {
  const licence = (read.licence || "").trim();
  if (licence) {
    const checked = checkLicence(licence);
    if (checked.status === "format-ok") {
      return { ...checked, title: `Read from the photo: ${checked.title}` };
    }
  }
  const brandBits = [read.brand, read.isNumber ? `IS ${read.isNumber}` : ""].filter(Boolean).join(" ");
  if (brandBits.trim()) {
    const checked = checkBrand(brandBits);
    if (checked.status === "brand-hit" || checked.status === "unclear") {
      return { ...checked, title: `Read from the photo: ${checked.title}` };
    }
  }
  return {
    status: "unreadable",
    title: "The mark could not be read",
    detail: "Use a clear photo of the ISI, CRS, or hallmark mark. JPG, PNG, or WEBP. If the number is visible to you, type it under Licence number. A blurry photo is not a failed certificate.",
    scheme: null,
    marks: [],
    officialUrl: MANAK,
    officialLabel: "Open MANAK",
    confidence: "none",
  };
}
