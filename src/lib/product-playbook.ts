export type SchemeKind = "isi" | "crs" | "hallmark";

export type ProductFamily = {
  id: string;
  aliases: string[];
  is: string[];
  scheme: SchemeKind | null;
  disambiguate?: string;
  /** Prefer catalogue title containing this substring when pinning an IS id. */
  preferTitle?: Record<string, string>;
};

const FAMILIES: ProductFamily[] = [
  {
    id: "cement",
    aliases: [
      "ordinary portland",
      "portland cement",
      "opc cement",
      "opc",
      "cementt",
      "siment",
      "cement",
      "सीमेन्ट",
      "सीमेंट",
    ],
    is: ["269", "8041", "12330", "12600", "16353", "1489"],
    scheme: "isi",
  },
  {
    id: "helmet-industrial",
    aliases: ["industrial safety helmet", "safety helmet", "factory helmet", "industrial helmet"],
    is: ["2925", "9695"],
    scheme: "isi",
  },
  {
    id: "helmet-bicycle",
    aliases: ["bicycle helmet", "cycle helmet", "skateboard helmet"],
    is: ["18808"],
    scheme: "isi",
  },
  {
    id: "helmet",
    aliases: ["helmet", "helmets", "हेलमेट"],
    is: ["2925", "18808", "2745", "9973"],
    scheme: "isi",
    disambiguate:
      "Say which use: industrial/factory (IS 2925), bicycle/skate (IS 18808), fire/civil defence (IS 2745), or scooter visor (IS 9973). Two-wheeler protective helmet IS 4151 is not in this catalogue pack.",
  },
  {
    id: "gold",
    aliases: [
      "gold jewellery",
      "gold jewelry",
      "gold artefact",
      "hallmark",
      "huid",
      "jewellery",
      "jewelry",
      "gehna",
      "सोने का गहना",
      "सोना",
      "गहना",
      "आभूषण",
      "हॉलमार्क",
      "हालमार्क",
    ],
    is: ["1417", "1418"],
    scheme: "hallmark",
  },
  {
    id: "pet-bottle",
    aliases: ["pet bottle", "plastic bottle", "packaged drinking", "terephthalate", "बोतल"],
    is: ["12252", "15609"],
    scheme: "isi",
    disambiguate:
      "IS 12252 is PET polymer for food contact. Packaged drinking water IS 14543 is not in this catalogue pack — confirm on Know Your Standard. IS 15609 is pouch packing for mineral/packaged drinking water.",
  },
  {
    id: "laptop",
    aliases: ["laptop", "notebook", "tablet", "लैपटॉप"],
    is: [],
    scheme: "crs",
  },
  {
    id: "charger",
    aliases: ["mobile charger", "phone charger", "adapter", "adaptor", "चार्जर"],
    is: [],
    scheme: "crs",
  },
  {
    id: "solar",
    aliases: ["solar panel", "photovoltaic", "solar pv", "सोलर"],
    is: ["16270", "12834"],
    scheme: "crs",
  },
  {
    id: "led",
    aliases: ["led lamp", "led bulb", "self ballasted led", "led luminaire", "bulb", "बल्ब"],
    is: ["16102", "16107"],
    scheme: "crs",
  },
  {
    id: "tyre",
    aliases: ["automotive tyre", "pneumatic tyre", "vehicle tyre", "tyre", "tire", "टायर"],
    is: ["15636", "15627", "15633"],
    scheme: "isi",
  },
  {
    id: "cooker",
    aliases: ["pressure cooker", "प्रेशर कुकर", "cooker", "कुकर"],
    is: ["17870", "7466"],
    scheme: "isi",
  },
  {
    id: "rebar",
    aliases: ["tmt bar", "deformed bar", "steel bar", "reinforcement bar", "steel bars"],
    is: ["1786", "432"],
    scheme: "isi",
  },
  {
    id: "steel-tube",
    aliases: ["steel tube", "steel pipes", "gi pipe", "ms pipe"],
    is: ["1161", "1239"],
    scheme: "isi",
  },
  {
    id: "cable",
    aliases: ["pvc cable", "electric cable", "electrical cable", "power cable", "केबल"],
    is: ["694", "1554"],
    scheme: "isi",
    disambiguate: "IS 694 is PVC insulated cables. IS 1554 is PVC insulated (heavy duty) cables. Confirm voltage grade on Know Your Standard.",
  },
  {
    id: "switch",
    aliases: ["plug socket", "socket outlet", "switch socket", "wall socket"],
    is: ["1293"],
    scheme: "isi",
  },
  {
    id: "lpg-stove",
    aliases: ["lpg stove", "gas stove", "domestic gas stove", "गैस चूल्हा"],
    is: ["17153"],
    scheme: "isi",
  },
  {
    id: "lpg",
    aliases: ["lpg cylinder", "lpg", "gas cylinder"],
    is: ["3196"],
    scheme: "isi",
  },
  {
    id: "plywood",
    aliases: ["plywood", "ply wood", "प्लाईवुड"],
    is: ["10701"],
    scheme: "isi",
  },
  {
    id: "webcam",
    aliases: ["webcam", "web cam", "web camera"],
    is: [],
    scheme: "crs",
  },
  {
    id: "power-bank",
    aliases: ["power bank", "powerbank", "पावर बैंक"],
    is: [],
    scheme: "crs",
  },
  {
    id: "milk-powder",
    aliases: ["whole milk powder", "milk powder", "दूध पाउडर"],
    is: ["1165"],
    scheme: "isi",
  },
  {
    id: "milk",
    aliases: ["packaged pasteurized milk", "pasteurized milk", "packaged milk", "दूध"],
    is: ["13688", "1165", "1166"],
    scheme: "isi",
    disambiguate:
      "Packaged pasteurized milk is IS 13688. Whole milk powder is IS 1165. Condensed milk is IS 1166. Say which form (liquid packed / powder / condensed).",
  },
  {
    id: "mixer-kitchen",
    aliases: ["mixer grinder", "mixie", "kitchen mixer", "food grinder", "मिक्सी", "मिक्सर ग्राइंडर"],
    is: ["302", "14366", "14367"],
    scheme: "isi",
    preferTitle: { "302": "kitchen machines" },
    disambiguate:
      "Pack has household electrical safety (IS 302 series, kitchen machines / food grinding) and food-processing mixer machinery (IS 14366/14367). A dedicated kitchen mixer-grinder product IS may not be listed — confirm on Know Your Standard and the live QCO list. This is not a concrete mixer.",
  },
  {
    id: "mixer-concrete",
    aliases: ["concrete mixer", "mortar mixer", "pan mixer"],
    is: ["5891", "12119", "5892"],
    scheme: "isi",
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(query: string, alias: string): boolean {
  const q = query.toLowerCase();
  const a = alias.toLowerCase();
  if (/[\u0900-\u097F]/.test(alias)) return q.includes(a);
  if (a.length <= 4) return new RegExp(`\\b${escapeRe(a)}\\b`, "i").test(query);
  return q.includes(a);
}

const ALIAS_INDEX = FAMILIES.flatMap((f) => f.aliases.map((a) => ({ a, f }))).sort(
  (x, y) => y.a.length - x.a.length,
);

export function matchProductFamily(query: string): ProductFamily | null {
  for (const { a, f } of ALIAS_INDEX) {
    if (hasAlias(query, a)) return f;
  }
  return null;
}

export function schemeNeedles(scheme: SchemeKind): RegExp {
  if (scheme === "crs") return /compulsory registration|\bcrs\b|scheme-ii|scheme-2/i;
  if (scheme === "hallmark") return /hallmark|huid|assaying/i;
  return /scheme-i|isi mark|product certification \(scheme/i;
}

export const CLAUSE_ASK =
  /\b(clause|section|full text|pdf of (the )?standard|what does is[\s/.-]*\d+ (say|contain))\b|क्लॉज|धारा/i;
