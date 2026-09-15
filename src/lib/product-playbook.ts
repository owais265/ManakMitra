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

export const HALLMARK_CUE =
  /hall\s*m+r?arks?|huid|assaying|\bahc\b|22\s*k|18\s*k|\b916\b|jewell|karigar|gehna|silversmith|22\s*carat|18\s*carat|fineness/i;

export const JEWELLERY_CUE =
  /\b(gold|silver|jewell\w*|gehna|karigar|silversmith|mangalsutra|artefact|22\s*k|18\s*k|916|22\s*carat|18\s*carat|assaying|\bahc\b)\b|सोना|गहना|आभूषण|चांदी/;

/** Products that never carry Hallmark/HUID — stop jewellery pins on cement/water/electronics. */
export const NON_JEWELLERY_PRODUCT =
  /\b(cements?|laptops?|notebooks?|tablets?|smartphones?|mobile phones?|cell phones?|air[\s-]?conditioners?|\bacs\b|\bac\b|refrigerators?|fridge|helmets?(?:\s+for\s+bikers)?|motorcycle helmets?|toys?\b|plugs?\b|switches?|led\s*bulbs?|electric irons?|pressure cookers?|cookers?\b|bottled waters?|mineral waters?|packaged drinking|milk powders?|infant foods?|footwears?|shoes?\b|steel utensils?|gas cylinders?|lpg|auto parts?|safety glass|led tvs?|cctv|power banks?|printers?|routers?|induction|microwaves?|cementt|siment|plywood|biscuits?|spices?|soaps?|forklifts?|bearings?|gaskets?|incense|detergents?|shampoos?|generators?|electric motors?|washing machines?|water purifiers?|ceramic tiles?|car tires?|tea powder|door locks?|matchboxes?|(?:room\s+)?coolers?|solar panels?|honey|inverters?|drones?|stoves?|sanitary ware|conveyor belts?|compressors?|hoists?|cranes?|flanges?|fittings?|shafts?|gears?|steel pipes?|x-?ray|medical devices?|smart locks?|webcams?|pos machines?|biometric|barcode|coffee beans?|toothpastes?|bicycle tubes?|weigh scales?|electric heaters?|microwave ovens?|lpg rubber|chemical fertilizers?|industrial valves?|elevator cables?|set-top|scanners?|lithium|agricultural pumps?|tmt bars?|transformers?|paint|regulators?|smart speakers?|smart meters?|circuit breakers?|ceiling fans?|cameras?|helmets?|candles?|\bups\b|wireless keyboards?)\b/i;

/** Map Indic / Hinglish tokens onto English so the same pins fire. */
const INDIC_GLOSS: Record<string, string> = {
  आवेदन: "application",
  फीस: "fee",
  शुल्क: "fee",
  लाइसेंस: "licence",
  लाइसेन्स: "licence",
  प्रयोगशाला: "laboratory",
  लैब: "lab",
  हॉलमार्क: "hallmark",
  हालमार्क: "hallmark",
  ह्यूइड: "huid",
  ह्यूआईडी: "huid",
  प्रमाणन: "certification",
  आईएसआई: "isi",
  आईएस: "IS",
  बीआईएस: "bis",
  सीआरएस: "crs",
  मानक: "standard",
  सोना: "gold",
  गहना: "jewellery",
  आभूषण: "jewellery",
  चांदी: "silver",
  शिकायत: "complaint",
  मार्क: "mark",
  योजना: "scheme",
  पंजीकरण: "registration",
  हेलमेट: "helmet",
  सीमेंट: "cement",
  मिक्सर: "mixer",
  ग्राइंडर: "grinder",
  लैपटॉप: "laptop",
  चार्जर: "charger",
  बोतल: "bottle",
  टायर: "tyre",
  प्रक्रिया: "process",
  अनिवार्य: "mandatory",
  नकली: "fake",
  फर्जी: "farzi",
  जुर्माना: "penalty",
  जांच: "verify",
  चेक: "verify",
  प्रयोग: "test",
  शाखा: "branch",
  कार्यालय: "office",
  खिलौना: "toy",
  खिलौने: "toys",
  पानी: "water",
  पाइप: "pipe",
  बर्तन: "utensils",
  कूलर: "room cooler",
  पंखा: "ceiling fan",
  टीवी: "led tv",
  मोबाइल: "smartphone",
  मसाला: "spices",
  नजदीकी: "nearest",
  हলমार्क: "hallmark",
  মান: "standard",
  প্রমাণ: "certification",
  হলমার্ক: "hallmark",
  ప్రమాణం: "standard",
  ధృవీకరణ: "certification",
  தரம்: "standard",
  சான்றிதழ்: "certification",
  മാനകം: "standard",
  ಗುಣಮಟ್ಟ: "standard",
  ધોરણ: "standard",
  ਮਾਪਦੰਡ: "standard",
};

export function glossIndic(q: string): string {
  let g = q;
  for (const [hi, en] of Object.entries(INDIC_GLOSS)) {
    if (g.includes(hi)) g += ` ${en}`;
  }
  return g;
}

export function isHallmarkSchemeMix(query: string, family?: ProductFamily | null): boolean {
  const q = glossIndic(query);
  if (!HALLMARK_CUE.test(q)) return false;
  if (family && family.scheme !== "hallmark") return true;
  if (NON_JEWELLERY_PRODUCT.test(q) && !JEWELLERY_CUE.test(q)) return true;
  return false;
}

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
    is: ["269", "8041", "12330", "12600", "16353", "1489", "455"],
    scheme: "isi",
  },
  {
    id: "stainless-utensils",
    aliases: [
      "stainless steel sheets for utensils",
      "stainless steel strips for utensils",
      "stainless steel sheets",
      "stainless steel strips",
      "stainless steel utensils",
      "cooking utensils",
      "kitchen utensils",
      "steel utensils",
      "sheets for utensils",
      "strips for utensils",
      "stainless utensils",
      "steel bartan",
      "बर्तन",
    ],
    is: ["5522", "15997"],
    scheme: "isi",
    preferTitle: { "5522": "utensils", "15997": "utensils" },
  },
  {
    id: "stainless-sink",
    aliases: ["stainless steel sink", "stainless steel kitchen sink", "kitchen sink", "steel sink"],
    is: ["13983"],
    scheme: "isi",
    preferTitle: { "13983": "sinks for domestic" },
  },
  {
    id: "geyser",
    aliases: [
      "stationary storage type electric water heater",
      "storage type electric water heater",
      "storage water heater",
      "electric geyser",
      "geyser",
    ],
    is: ["2082"],
    scheme: "isi",
    preferTitle: { "2082": "Stationary storage" },
  },
  {
    id: "packaged-water",
    aliases: [
      "packaged drinking water",
      "packaged natural mineral water",
      "bottled water",
      "mineral water bottle",
      "mineral water",
      "packaged water",
    ],
    is: ["15609"],
    scheme: "isi",
    preferTitle: { "15609": "packaged drinking" },
    disambiguate:
      "This catalogue snapshot has IS 15609 (pouches for mineral / packaged drinking water). Packaged drinking water itself (commonly IS 14543) and packaged natural mineral water (commonly IS 13428) are not in this snapshot — confirm the live title and QCO on Know Your Standard. Do not invent an edition year.",
  },
  {
    id: "drinking-water",
    aliases: [
      "piped drinking water",
      "municipal drinking water",
      "drinking water is 10500",
      "is 10500",
      "drinking water",
      "potable water specification",
    ],
    is: ["10500"],
    scheme: null,
    preferTitle: { "10500": "Drinking water" },
    disambiguate:
      "IS 10500 is drinking water (piped / municipal) specification. Packaged bottled water is a different standard — confirm IS 14543 / IS 13428 on Know Your Standard.",
  },
  {
    id: "paver",
    aliases: ["paver block", "paving block", "concrete paver", "concrete paving block"],
    is: ["15658"],
    scheme: "isi",
    preferTitle: { "15658": "Paving Blocks" },
  },
  {
    id: "ceiling-fan",
    aliases: ["ceiling type fan", "ceiling fan", "ceiling fans"],
    is: ["374"],
    scheme: "isi",
    preferTitle: { "374": "Ceiling Type Fans" },
  },
  {
    id: "mobile-phone",
    aliases: ["mobile phone handset", "mobile phones", "smart phone", "smartphone", "mobile phone", "cell phone"],
    is: ["16333"],
    scheme: "crs",
    preferTitle: { "16333": "Mobile Phone Handsets" },
  },
  {
    id: "printer",
    aliases: ["printers plotters", "printer plotter", "plotters", "printers", "plotter", "printer"],
    is: [],
    scheme: "crs",
  },
  {
    id: "induction-stove",
    aliases: ["induction cooktop", "induction cooker", "induction stove"],
    is: [],
    scheme: "crs",
  },
  {
    id: "high-vis",
    aliases: ["high visibility warning", "high visibility vest", "safety vest", "warning clothes"],
    is: ["15809"],
    scheme: "isi",
  },
  {
    id: "energy-meter",
    aliases: ["static watthour meter", "electricity meter", "energy meter", "smart meter"],
    is: ["13779", "14697"],
    scheme: "isi",
  },
  {
    id: "distribution-transformer",
    aliases: ["oil immersed distribution transformer", "distribution transformer"],
    is: ["1180"],
    scheme: "isi",
    preferTitle: { "1180": "Distribution Transformers" },
  },
  {
    id: "safety-glass",
    aliases: ["automotive safety glass", "toughened safety glass", "windshield glass", "safety glass"],
    is: ["2553"],
    scheme: "isi",
    preferTitle: { "2553": "road transport" },
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
      "silver jewellery",
      "silver jewelry",
      "silver artefact",
      "silver coins",
      "silver coin",
      "huid",
      "jewellery",
      "jewelry",
      "jeweller",
      "jewellers",
      "karigar",
      "silversmith",
      "assaying",
      "ahc",
      "gehna",
      "सोने का गहना",
      "सोना",
      "गहना",
      "आभूषण",
      "916 gold",
      "22k gold",
      "18k gold",
      "22 carat",
      "22 kt",
      "18 kt",
      "22k",
      "18k",
      "916",
      "mangalsutra",
      "hall mark",
      "hallmarking",
      "hallmark",
      "हॉलमार्क",
      "हालमार्क",
      "gold",
    ],
    is: ["1417", "1418"],
    scheme: "hallmark",
    disambiguate:
      "Jewellery to verify (gold or silver, and purity such as 22K/916), an HUID check in the BIS CARE app, or applying as a jeweller?",
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
    id: "electric-iron",
    aliases: ["electric irons", "electric iron", "iron box"],
    is: [],
    scheme: "isi",
    disambiguate:
      "No dedicated electric-iron IS is pinned in this snapshot. Look up the live title and QCO on Know Your Standard. Do not invent an IS. Hallmark/HUID is jewellery, not irons.",
  },
  {
    id: "laptop",
    aliases: ["laptop", "notebook", "tablet", "लैपटॉप"],
    is: [],
    scheme: "crs",
  },
  {
    id: "charger",
    aliases: ["mobile charger", "phone charger", "power adapter", "adapter", "adaptor", "चार्जर"],
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
    aliases: ["automotive tyre", "pneumatic tyre", "vehicle tyre", "tyre", "tires", "tire", "टायर"],
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
    aliases: ["tmt bars", "tmt bar", "deformed bar", "steel bar", "reinforcement bar", "steel bars", "tmt"],
    is: ["1786", "432"],
    scheme: "isi",
  },
  {
    id: "steel-tube",
    aliases: ["steel tube", "steel pipes", "steel pipe", "gi pipe", "ms pipe"],
    is: ["1161", "1239"],
    scheme: "isi",
  },
  {
    id: "cable",
    aliases: [
      "pvc cable",
      "electric cable",
      "electrical cable",
      "power cable",
      "electrical wiring materials",
      "electrical wiring",
      "wiring materials",
      "केबल",
    ],
    is: ["694", "1554"],
    scheme: "isi",
    disambiguate:
      "IS 694 is PVC insulated cables. IS 1554 is PVC insulated (heavy duty) cables. Confirm voltage grade on Know Your Standard.",
  },
  {
    id: "switch",
    aliases: ["plug socket", "socket outlet", "switch socket", "wall socket", "plugs", "plug", "switches"],
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
    id: "mixer",
    aliases: ["mixer", "मिक्सर"],
    is: [],
    scheme: null,
    disambiguate: "Kitchen mixer-grinder, or a concrete/mortar mixer?",
  },
  {
    id: "mixer-concrete",
    aliases: ["concrete mixer", "mortar mixer", "pan mixer"],
    is: ["5891", "12119", "5892"],
    scheme: "isi",
  },
  {
    id: "pvc-pipe",
    aliases: ["upvc pipe", "uPVC pipe", "pvc pipes", "pvc pipe", "potable water pipe"],
    is: ["4985"],
    scheme: "isi",
    preferTitle: { "4985": "Unplasticized PVC Pipes for Potable" },
  },
  {
    id: "ceramic-tile",
    aliases: ["pressed ceramic tile", "ceramic tiles", "ceramic tile"],
    is: ["15622"],
    scheme: "isi",
    preferTitle: { "15622": "Pressed Ceramic Tiles" },
  },
  {
    id: "syringe",
    aliases: ["hypodermic syringe", "syringes", "syringe"],
    is: ["10258"],
    scheme: "isi",
    preferTitle: { "10258": "hypodermic syringes" },
  },
  {
    id: "circuit-breaker",
    aliases: ["circuit breakers", "circuit breaker", "mccb"],
    is: ["13947"],
    scheme: "isi",
    preferTitle: { "13947": "Circuit Breakers" },
    disambiguate:
      "Catalogue pins low-voltage circuit-breakers (IS 13947 / IS/IEC 60947-2). Confirm rating and live QCO status on Know Your Standard. High-voltage switchgear is a different series.",
  },
  {
    id: "television",
    aliases: ["television receiver", "led tv", "television"],
    is: [],
    scheme: "crs",
  },
  {
    id: "microwave",
    aliases: ["microwave oven", "microwave"],
    is: [],
    scheme: "crs",
  },
  {
    id: "storage-battery",
    aliases: ["storage battery", "inverter battery"],
    is: [],
    scheme: "crs",
  },
  {
    id: "toys",
    aliases: ["toys", "toy", "खिलौना", "खिलौने"],
    is: ["9873", "15644"],
    scheme: "isi",
    preferTitle: { "9873": "Part 1", "15644": "15644" },
  },
  {
    id: "pipe",
    aliases: ["pipes", "pipe"],
    is: [],
    scheme: null,
    disambiguate:
      "Which pipe — PVC for drinking water (IS 4985), steel/GI (IS 1161 / 1239), or another material?",
  },
  {
    id: "electric-kettle",
    aliases: ["electric kettles", "electric kettle", "electric jugs", "electric jug"],
    is: ["367"],
    scheme: "isi",
    preferTitle: { "367": "Electric kettles" },
  },
  {
    id: "cutlery",
    aliases: ["kitchen knives", "kitchen knife", "household cutlery", "table holloware", "cutlery"],
    is: ["15104"],
    scheme: null,
    preferTitle: { "15104": "Cutlery" },
    disambiguate:
      "Pack pins IS 15104 (cutlery and table holloware, food-contact). Confirm the exact part on Know Your Standard. IS 5908 in this catalogue is electrical installations in buildings, not knives.",
  },
  {
    id: "paint",
    aliases: ["paint/coatings", "enamel paint", "ready mixed paint", "paints", "paint", "coatings"],
    is: [],
    scheme: null,
    disambiguate:
      "Paint IS depends on type (ready-mixed, enamel, distemper, powder). IS 383 in this catalogue is coarse and fine aggregate for concrete, not paint. Name the paint type or look it up on Know Your Standard.",
  },
  {
    id: "leather-footwear",
    aliases: ["leather footwear", "leather shoes", "leather shoe", "footwear"],
    is: ["2051"],
    scheme: null,
    preferTitle: { "2051": "Leather Footwear" },
    disambiguate:
      "IS 2051 in this snapshot is a sampling method for leather footwear, not a full construction spec. Confirm the live footwear IS on Know Your Standard.",
  },
  {
    id: "pharma-packaging",
    aliases: [
      "pharmaceutical packaging",
      "pharma packaging",
      "pharmaceutical container",
      "pharmaceutical containers",
    ],
    is: ["7803", "16011"],
    scheme: null,
    disambiguate:
      "Pack has plastic containers for pharmaceutical use (IS 7803) and aluminium foil for pharmaceutical packaging (IS 16011). Say which material.",
  },
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAlias(query: string, alias: string): boolean {
  if (/[\u0900-\u097F]/.test(alias)) return query.toLowerCase().includes(alias.toLowerCase());
  const words = alias.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const last = words[words.length - 1];
  const head = words.slice(0, -1).map(escapeRe).join("\\s+");
  const body = head ? `${head}\\s+${escapeRe(last)}` : escapeRe(last);
  return new RegExp(`\\b${body}s?\\b`, "i").test(query);
}

const ALIAS_INDEX = FAMILIES.flatMap((f) => f.aliases.map((a) => ({ a, f }))).sort(
  (x, y) => y.a.length - x.a.length,
);

export function listProductFamilies(): ProductFamily[] {
  return FAMILIES.slice();
}

export function matchProductFamily(query: string): ProductFamily | null {
  const q = glossIndic(query.replace(/halll+mark|hallmrk|hall\s+mark/gi, "hallmark"));
  const hits: ProductFamily[] = [];
  const seen = new Set<string>();
  for (const { a, f } of ALIAS_INDEX) {
    if (!hasAlias(q, a) || seen.has(f.id)) continue;
    seen.add(f.id);
    hits.push(f);
  }
  if (!hits.length) return null;
  // "Hallmark on cement" must not become gold just because "hallmark" is a gold alias.
  const other = hits.filter((f) => f.scheme !== "hallmark");
  if (other.length) return other[0];
  return hits[0];
}

const SPECIFIC_PRODUCT =
  /\b(916|22k|18k|huid|industrial|factory|bicycle|cycle|skate|mixer grinder|mixie|pvc pipe|upvc|concrete mixer|potable|gi pipe|steel pipe|steel tube|compensation|shortfall|geyser|stainless steel|paver|ceiling fan|packaged drinking|mineral water)\b|सोने का|गहना|आभूषण/i;

/** Underspecified product: ask one clarifying question instead of pinning an IS. */
export function shouldClarify(query: string): string | null {
  if (/\bIS[\s/.-]*\d+/i.test(query)) return null;
  const fam = matchProductFamily(query);
  if (!fam?.disambiguate) return null;
  if (SPECIFIC_PRODUCT.test(query)) return null;
  return fam.disambiguate;
}

export function schemeNeedles(scheme: SchemeKind): RegExp {
  if (scheme === "crs") return /compulsory registration|\bcrs\b|scheme-ii|scheme-2/i;
  if (scheme === "hallmark") return /hallmark|huid|assaying/i;
  return /scheme-i|isi mark|product certification \(scheme/i;
}

export const CLAUSE_ASK =
  /\b(clause|section|full text|pdf of (the )?standard|what does is[\s/.-]*\d+ (say|contain))\b|क्लॉज|धारा/i;
