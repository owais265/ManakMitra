import type { AppLang } from "@/lib/language";
import { FOLLOW_CUE, MICRO_FOLLOW, historyLooksBis, type ChatTurn } from "@/lib/query-context";
import { matchProductFamily } from "@/lib/product-playbook";

export type ChatIntent = "social" | "bis" | "offtopic";

const BIS_HINT =
  /\b(is[\s/.-]*\d+|indian standard|standard mark|bis\b|isi\b|crs\b|fmcs\b|qco\b|iso\b|iec\b|hallmark|huid|lab(?:orator)?y?|licence|license|certif|fee|gold|silver|jewell|msme|manak|testing|complaint|grievance|scheme(?:-?[i12x])?|option-?2|packaged|pet\b|plastic|electronics|registration|compulsory|explore|helmet|cement|mixer|grinder|laptop|charger|tyre|tire|portland|cooker|training|club)\b/i;

const BIS_NATIVE =
  /मानक|प्रमाणन|हॉलमार्क|हालमार्क|प्रयोगशाला|लाइसेंस|लाइसेंस|फीस|सोना|चांदी|शिकायत|आईएसआई|सीआरएस|ब्यूरो|हेलमेट|सीमेंट|मिक्सर|गहना|आभूषण|মান|প্রমাণ|হলমার্ক|ప్రమాణం|ధృవీకరణ|தரம்|சான்றிதழ்|മാനകം|ಗುಣಮಟ್ಟ|ધોરણ|ਮਾਪਦੰਡ/;

const SOCIAL_CUE =
  /\b(hi+|hii+|hello|hey|namaste|namaskar|thanks?|thank you|ok+|okay|bye|goodbye|good\s*(morning|evening|afternoon|night)|how are you|who are you|what(?:'s| is) your name|tell (me )?(about )?(your\s*)?self|about yourself|what can you do|introduce yourself|help( me)?|kaun ho|kya kar (sakte|sakti)|apna parichay)\b/i;

const SOCIAL_NATIVE = /नमस्ते|नमस्कार|धन्यवाद|आप कौन|मदद|কেমন আছ|வணக்கம்|నమస్కారం|നമസ്കാരം|ನಮಸ್ಕಾರ|નમસ્તે|ਸਤ ਸ੍ਰੀ ਅਕਾਲ/;

const INDIC = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF]/;

export function classifyIntent(query: string, history?: ChatTurn[]): ChatIntent {
  const q = query.trim();
  if (!q) return "social";
  if (/\bIS[\s/.-]*\d+/i.test(q) || BIS_HINT.test(q) || BIS_NATIVE.test(q) || matchProductFamily(q)) return "bis";
  if (q.length < 160 && (FOLLOW_CUE.test(q) || MICRO_FOLLOW.test(q)) && historyLooksBis(history)) return "bis";
  if ((SOCIAL_CUE.test(q) || SOCIAL_NATIVE.test(q)) && q.length < 220) return "social";
  if (q.length <= 24 && /^(hi+|hello|hey|namaste)[!.\s]*$/i.test(q)) return "social";
  if (INDIC.test(q)) return "bis";
  return "offtopic";
}

export function socialReply(language: AppLang): string {
  if (language === "hi" || language === "mr") {
    return `### नमस्ते, मैं **मानक-मित्र (ManakMitra)** हूँ

मैं Bureau of Indian Standards (BIS) का AI सहायक हूँ। मैं आपसे हल्की बात कर सकता हूँ, लेकिन मेरा काम भारतीय मानकों और BIS सेवाओं में मदद करना है।

मैं इनमें मदद करता हूँ:
* प्रोडक्ट के लिए लागू **Indian Standard (IS)** ढूँढना
* **ISI / CRS / FMCS / QCO** प्रमाणन का रास्ता
* **हॉलमार्किंग / HUID**
* BIS मान्यता प्राप्त **प्रयोगशाला**
* उपभोक्ता शिकायत कहाँ दर्ज करें

जो बात आधिकारिक BIS सूची में नहीं है, उसे मैं गढ़ूँगा नहीं — साफ बोल दूँगा।

मैं tender/procurement specification engine नहीं हूँ — MSME और उपभोक्ता के BIS सवाल (standard, scheme, hallmark, lab, शिकायत) पर काम करता हूँ।

आज किस प्रोडक्ट या सेवा पर काम करना है?

[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] क्या आप कोई प्रोडक्ट बताएँ (जैसे PET बोतल, लैपटॉप, सोने का गहना)?
[META] high | general`;
  }
  return `### Namaste — I am **ManakMitra**

I am the Bureau of Indian Standards (BIS) assistant. I can greet you and explain what I do, but I stay inside BIS: Indian Standards, certification, hallmarking, labs, and consumer help.

I can:
* Match a product description to an **Indian Standard** (catalogue metadata)
* Walk through **ISI / CRS / FMCS / QCO** steps and official FAQ fees
* Explain **hallmarking / HUID**
* Point to **BIS-recognised laboratories**
* Show where to file a **consumer complaint**

If it is not in the authorised BIS pack, I will say so instead of inventing an IS number.

I am not a tender/procurement specification engine — I handle MSME and consumer BIS questions (standards, schemes, hallmarking, labs, complaints).

What should we look up — a product, a mark, a lab, or a process?

[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] Which product or BIS service should we start with?
[META] high | general`;
}

export function offtopicReply(language: AppLang): string {
  if (language === "hi" || language === "mr") {
    return `मैं **मानक-मित्र** हूँ — सामान्य चैट-बॉट नहीं। मैं भारतीय मानक ब्यूरो (BIS) से जुड़े सवालों पर ही काम करता हूँ: IS कोड, ISI/CRS प्रमाणन, हॉलमार्क, लैब, शिकायत।

क्रिकेट, फिल्म या अन-संबंधित विषय पर जवाब नहीं दे सकता। कोई प्रोडक्ट या BIS सेवा बताइए, मैं वहीं से आगे बढ़ाता हूँ।

[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] क्या आप BIS से जुड़ा सवाल पूछना चाहेंगे — जैसे प्रमाणन, हॉलमार्क या लैब?
[META] low | general`;
  }
  return `I am **ManakMitra**, not a general chatbot. I only help with Bureau of Indian Standards (BIS) topics: Indian Standards, ISI/CRS/FMCS certification, hallmarking, labs, and consumer complaints.

I cannot answer unrelated subjects. Share a product or BIS service and I will look it up in the authorised catalogue.

[SOURCE] ManakMitra | assistant | 2026-09-07 | https://www.bis.gov.in
[FOLLOW_UP] Want to try a BIS question — a product, hallmark, or laboratory?
[META] low | general`;
}
