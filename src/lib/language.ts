export const APP_LANGS = [
  { id: "en", native: "English", speech: "en-IN", prompt: "English" },
  { id: "hi", native: "हिन्दी", speech: "hi-IN", prompt: "Hindi (Devanagari)" },
  { id: "bn", native: "বাংলা", speech: "bn-IN", prompt: "Bengali (Bangla script)" },
  { id: "te", native: "తెలుగు", speech: "te-IN", prompt: "Telugu script" },
  { id: "mr", native: "मराठी", speech: "mr-IN", prompt: "Marathi (Devanagari)" },
  { id: "ta", native: "தமிழ்", speech: "ta-IN", prompt: "Tamil script" },
  { id: "ur", native: "اردو", speech: "ur-IN", prompt: "Urdu (Nastaliq)" },
  { id: "gu", native: "ગુજરાતી", speech: "gu-IN", prompt: "Gujarati script" },
  { id: "kn", native: "ಕನ್ನಡ", speech: "kn-IN", prompt: "Kannada script" },
  { id: "ml", native: "മലയാളം", speech: "ml-IN", prompt: "Malayalam script" },
  { id: "pa", native: "ਪੰਜਾਬੀ", speech: "pa-IN", prompt: "Punjabi (Gurmukhi)" },
  { id: "or", native: "ଓଡ଼ିଆ", speech: "or-IN", prompt: "Odia script" },
  { id: "as", native: "অসমীয়া", speech: "as-IN", prompt: "Assamese (Bengali-Assamese script)" },
] as const;

export type AppLang = (typeof APP_LANGS)[number]["id"];

const LANG_IDS = new Set<string>(APP_LANGS.map((l) => l.id));

export function isAppLang(v: string | undefined | null): v is AppLang {
  return !!v && LANG_IDS.has(v);
}

export function langPromptName(lang: AppLang): string {
  return APP_LANGS.find((l) => l.id === lang)?.prompt || "English";
}

export function speechLang(lang: AppLang): string {
  return APP_LANGS.find((l) => l.id === lang)?.speech || "en-IN";
}

/** Detect script of the typed text. Keep the toggle language if the text is Latin. */
export function detectLanguage(text: string, current: AppLang = "en"): AppLang {
  if (/[\u0900-\u097F]/.test(text)) {
    if (current === "mr") return "mr";
    return "hi";
  }
  if (/[\u0980-\u09FF]/.test(text)) return current === "as" ? "as" : "bn";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  if (/[\u0B00-\u0B7F]/.test(text)) return "or";
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  if (/\b(kya|hai|kaise|ke liye|mujhe|chahiye|bataye|krdo|karo)\b/i.test(text) && current === "en") {
    return "hi";
  }
  return current;
}

type UiPack = {
  disclaimer: string;
  instruction: string;
  micDenied: string;
  micUnsupported: string;
  micWaiting: string;
  errorServer: string;
  welcomeTitle: string;
  welcomeDesc: string;
  thinking: string;
  sources: string;
  documents: string;
  highConf: string;
  medConf: string;
  lowConf: string;
  followUp: string;
  contextHelper: string;
  relatedStandards: string;
  certRoadmap: string;
  understandingPurity: string;
  huidLookup: string;
  enterHuid: string;
  verifyJeweller: string;
  quickLinks: string;
  recentChats: string;
  shareConversation: string;
  shareNoContent: string;
  shareSuccess: string;
  bookmarks: string;
  noBookmarks: string;
  bookmarkAdded: string;
  bookmarkRemoved: string;
  offlineTitle: string;
  offlineDesc: string;
  cachedHistoryBadge: string;
  micListening: string;
  micNoSpeech: string;
  micNetworkError: string;
};

const EN: UiPack = {
  disclaimer: "This information is based on official BIS documents. Please verify with BIS officials for legal matters.",
  instruction: "Ask your question or describe your product...",
  micDenied: "Microphone permission denied. Please allow it in your browser settings.",
  micUnsupported: "Your browser does not support speech recognition. Please use Google Chrome.",
  micWaiting: "Waiting for microphone permission...",
  errorServer: "Sorry, there was an error connecting to the server.",
  welcomeTitle: "Namaste! I am ManakMitra",
  welcomeDesc: "BIS AI Assistant - Your guide to Indian Standards and Certification",
  thinking: "ManakMitra is thinking...",
  sources: "Sources",
  documents: "documents",
  highConf: "High Confidence (80-100% match)",
  medConf: "Needs Verification (55-79% match)",
  lowConf: "Insufficient Evidence (0-54% match)",
  followUp: "Please provide these details:",
  contextHelper: "Contextual Helper",
  relatedStandards: "Related Standards",
  certRoadmap: "Certification Roadmap",
  understandingPurity: "Understanding Purity",
  huidLookup: "HUID Lookup Tool",
  enterHuid: "Enter 6-digit HUID",
  verifyJeweller: "Verify Jeweller",
  quickLinks: "Quick Links",
  recentChats: "Recent Chats",
  shareConversation: "Share Conversation",
  shareNoContent: "No conversation to share.",
  shareSuccess: "Conversation copied to clipboard!",
  bookmarks: "Bookmarks",
  noBookmarks: "No saved messages yet.",
  bookmarkAdded: "Message bookmarked!",
  bookmarkRemoved: "Bookmark removed.",
  offlineTitle: "Offline / Limited Connectivity",
  offlineDesc: "You are currently offline. You can still view and search your cached conversation history.",
  cachedHistoryBadge: "Cached History",
  micListening: "Listening... speak now",
  micNoSpeech: "No speech detected. Tap mic to speak again.",
  micNetworkError: "Speech recognition requires an active internet connection.",
};

const HI: UiPack = {
  ...EN,
  disclaimer: "यह जानकारी आधिकारिक BIS दस्तावेज़ों पर आधारित है। कानूनी मामलों के लिए BIS अधिकारियों से सत्यापित करें।",
  instruction: "अपना सवाल पूछें या प्रोडक्ट बताएं...",
  micDenied: "माइक्रोफ़ोन की अनुमति अस्वीकार कर दी गई है। कृपया अपने ब्राउज़र में अनुमति दें।",
  micUnsupported: "आपका ब्राउज़र स्पीच रिकग्निशन को सपोर्ट नहीं करता है। कृपया Google Chrome का उपयोग करें।",
  micWaiting: "माइक्रोफ़ोन अनुमति की प्रतीक्षा की जा रही है...",
  errorServer: "क्षमा करें, सर्वर से जुड़ने में त्रुटि हुई। कृपया पुनः प्रयास करें।",
  welcomeTitle: "नमस्ते! मैं मानक-मित्र हूँ",
  welcomeDesc: "BIS AI असिस्टेंट - भारतीय मानकों और प्रमाणन के लिए आपका मार्गदर्शक",
  thinking: "मानक-मित्र सोच रहा है...",
  sources: "स्रोत",
  documents: "दस्तावेज़",
  highConf: "उच्च विश्वास (80-100% मिलान)",
  medConf: "सत्यापन आवश्यक (55-79% मिलान)",
  lowConf: "अपर्याप्त साक्ष्य (0-54% मिलान)",
  followUp: "कृपया ये विवरण बताएं:",
  contextHelper: "प्रासंगिक सहायक",
  relatedStandards: "संबंधित मानक",
  certRoadmap: "प्रमाणन रोडमैप",
  understandingPurity: "शुद्धता को समझना",
  huidLookup: "HUID लुकअप टूल",
  enterHuid: "6-अंकीय HUID दर्ज करें",
  verifyJeweller: "ज्वैलर को सत्यापित करें",
  shareConversation: "बातचीत साझा करें",
  shareNoContent: "साझा करने के लिए कोई बातचीत नहीं है।",
  shareSuccess: "बातचीत क्लिपबोर्ड पर कॉपी हो गई!",
  bookmarks: "सहेजे गए संदेश",
  noBookmarks: "अभी तक कोई संदेश नहीं सहेजा गया।",
  bookmarkAdded: "संदेश बुकमार्क किया गया!",
  bookmarkRemoved: "बुकमार्क हटा दिया गया।",
  offlineTitle: "ऑफ़लाइन / सीमित कनेक्टिविटी",
  offlineDesc: "आप अभी ऑफ़लाइन हैं। आप अभी भी अपने सहेजे गए वार्तालाप इतिहास को देख सकते हैं।",
  cachedHistoryBadge: "कैश्ड इतिहास",
  micListening: "सुन रहा हूँ... अब बोलिए",
  micNoSpeech: "कोई आवाज़ नहीं मिली। दोबारा बोलने के लिए माइक दबाएं।",
  micNetworkError: "आवाज़ पहचानने के लिए इंटरनेट कनेक्शन आवश्यक है।",
};

export const UI_DICTIONARY: Record<AppLang, UiPack> = {
  en: EN,
  hi: HI,
  bn: EN,
  te: EN,
  mr: HI,
  ta: EN,
  ur: EN,
  gu: EN,
  kn: EN,
  ml: EN,
  pa: EN,
  or: EN,
  as: EN,
};

export const getUIDisclaimers = (lang: AppLang): string => UI_DICTIONARY[lang].disclaimer;
export const getUIInstructions = (lang: AppLang): string => UI_DICTIONARY[lang].instruction;
