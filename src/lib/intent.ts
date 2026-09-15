import { offtopicCopy, socialCopy, type AppLang } from "@/lib/language";
import { FOLLOW_CUE, isFollowCue, type ChatTurn } from "@/lib/query-context";
import { matchProductFamily, glossIndic } from "@/lib/product-playbook";

export type ChatIntent = "social" | "bis" | "offtopic";

const BIS_HINT =
  /\b(is[\s/.-]*\d+|indian standards?|standards?|standard marks?|bis\b|isi\b|crs\b|fmcs\b|qco\b|iso\b|iec\b|nabl\b|agmark|eco[\s-]?mark|ecomark|hall\s*marks?|huid|ahc\b|assaying|karigar|silversmith|purity|lab(?:orator(?:y|ies))?|lims\b|licen[cs]es?|certif\w*|fees?|costs?|gold|silver|jewell\w*|msme|manakonline|manak|testing|complaints?|grievance|scheme(?:-?[i12x])?|option-?[12]|simplified procedure|packaged|pet\b|plastic|electronics|registration|compulsory|explore|helmets?|cement|mixer|grinder|laptop|charger|tyre|tire|portland|cooker|training|club|care app|916|22k|18k|tmt|syringe|pvc pipe|ceramic tile|circuit breaker|microwave|television|toys?|helpline|headquarters|head office|head of|r-?number|utensils?|geyser|stainless|paver|bottled|mineral water|drinking water|induction|printer|smartphone|transformer|energy meter|safety glass|ceiling fan|textile|clause|bartan|bottles?|conformity|compliance|voluntary|mandatory|surveillance|inspection|accredit|nabl|17025|paint|coatings?|footwear|cutlery|knives?|kettle|pharmaceutical|packaging|wiring|penalty|uncertified|unlicensed|counterfeit|imported|deemed|expedit\w*|expir\w*|funded|enquiry|technical committee|quality control|food products?|published|withdrawn|revised|revision|harmoniz\w*|transition|prerequisite|documents? required|reappl\w*|appeal|consumer protection|manufactur|authorized indian representative|full form of air|full form of nws|full form of lrs|stop[\s-]?marking|stop[\s-]?sale|non-conformance|electric irons?|meity|dpiit|mutual recognition|\bmra\b|compensation|nws portal|\bnws\b|\blrs\b|\bcro\b|genuine|\baudits?\b|\bnoc\b|cro approval|importing|fall under air|fall under cro|tatkal|\bpbg\b|farzi|compounding|ncr closure|homemade|e-commerce|quality mark|air process|scheme-iv|scheme x|subsidy|marking fee|women entrepreneurs|startups|plywood|biscuits|spices|soaps|forklifts|bearings|gaskets|incense|detergents|shampoos|can an air for|an air for|air branch|air ka|which air|air approved|approved labs|normal procedure|clause of is|smart locks?|hoists?|search and seizure)\b/i;

const MESSY_IS =
  /\bindian\s+standards?\s+\d{3,5}\b|\b\d{3,5}\s*[:/\-]\s*(?:19|20)\d{2}\b|\b\d{3,5}\s+(?:19|20)\d{2}\b/i;

const BIS_NATIVE =
  /मानक|प्रमाणन|हॉलमार्क|हालमार्क|ह्यूइड|ह्यूआईडी|बीआईएस|आईएसआई|सीआरएस|प्रयोगशाला|लाइसेंस|फीस|शुल्क|जुर्माना|नकली|फर्जी|अनिवार्य|सोना|चांदी|शिकायत|ब्यूरो|हेलमेट|सीमेंट|मिक्सर|गहना|आभूषण|মান|প্রমাণ|হলমার্ক|ప్రమాణం|ధృవీకరణ|தரம்|சான்றிதழ்|മാനകം|ಗುಣಮಟ್ಟ|ધોરણ|ਮਾਪਦੰਡ/;

const SOCIAL_CUE =
  /\b(hii+|hello|hey|namaste|namaskar|thanks?|thank you|ok+|okay|bye|goodbye|good\s*(morning|evening|afternoon)|how are you|who are you|what(?:'s| is) your name|tell (me )?(about )?(your\s*)?self|about yourself|what can you do|introduce yourself|help me\b|can you help|need help|kaun ho|kya kar (sakte|sakti)|apna parichay)\b|^(hi|hii+|hello|hey)([,\s!.]|$)|^(help)[!.?\s]*$/i;

const SOCIAL_NATIVE = /नमस्ते|नमस्कार|धन्यवाद|आप कौन|मदद|কেমন আছ|வணக்கம்|నమస్కారం|നമസ്കാരം|ನಮಸ್ಕಾರ|નમસ્તે|ਸਤ ਸ੍ਰੀ ਅਕਾਲ/;

const INDIC = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF]/;

const OFFTOPIC_HARD =
  /\b(ipl|cricket|biryani|recipe|cook|fever|prescribe|share price|movie|film|football|world cup|horoscope)\b|who won (the )?(match|game|ipl)/i;

const GENERIC_STANDARD_ASK =
  /\b(what (is|are) (an |the )?indian standards?|how many indian standards?|can indian standards?|find applicable indian standards?|conformity to is\b|a standard be (revised|withdrawn)|manufacturing standards? revised|equivalent standard|tolerance limits in a standard|grade and standard|standards? (help|used in|contribute)|role of (bis|technical committees)|how is bis funded|contact bis|penalty for selling|uncertified products?|how to start bis|documents does bis|bis test reports|bis funded|factory inspection|during surveillance|third-party (laborator|test)|international test reports?|in-house and third-party|test samples selected|product fails testing|accelerated testing|deemed certification|licenses? for multiple products|voluntary to mandatory|imported products? subject|support does bis|track isi|certification be expedited|after isi licen[cs]e expires|what are the safety requirements)\b/i;

export function classifyIntent(query: string, _history?: ChatTurn[]): ChatIntent {
  const q = glossIndic(query.trim());
  if (!q) return "social";
  if (OFFTOPIC_HARD.test(q)) return "offtopic";

  const cueOnly = isFollowCue(q) && !matchProductFamily(q) && !/\bIS[\s/.-]*\d+/i.test(q) && !MESSY_IS.test(q);
  if (cueOnly) return "social";

  const hasBis =
    /\bIS[\s/.-]*\d+/i.test(q) ||
    MESSY_IS.test(q) ||
    BIS_HINT.test(q) ||
    BIS_NATIVE.test(q) ||
    GENERIC_STANDARD_ASK.test(q) ||
    Boolean(matchProductFamily(q));
  if (hasBis) return "bis";
  if (FOLLOW_CUE.test(q) && q.length < 40 && !hasBis) return "social";
  if ((SOCIAL_CUE.test(q) || SOCIAL_NATIVE.test(q)) && q.length < 220) return "social";
  if (q.length <= 24 && /^(hi+|hello|hey|namaste)[!.\s]*$/i.test(q)) return "social";
  if (INDIC.test(q)) return "bis";
  return "offtopic";
}

export function socialReply(language: AppLang): string {
  return socialCopy(language);
}

export function offtopicReply(language: AppLang): string {
  return offtopicCopy(language);
}
