import { speechLang, type AppLang } from "./language.ts";

export type VoiceLike = { lang: string; name?: string };

const LABEL: Record<AppLang, string> = {
  en: "Read the answer aloud",
  hi: "जवाब सुनें",
  bn: "উত্তর শুনুন",
  ta: "பதிலைக் கேளுங்கள்",
  te: "సమాధానం వినండి",
  mr: "उत्तर ऐका",
  gu: "જવાબ સાંભળો",
  kn: "ಉತ್ತರ ಕೇಳಿ",
  ml: "ഉത്തരം കേൾക്കുക",
  pa: "ਜਵਾਬ ਸੁਣੋ",
  ur: "جواب سنیں",
  or: "ଉତ୍ତର ଶୁଣନ୍ତୁ",
};

export function readAloudLabel(lang: AppLang): string {
  return LABEL[lang] || LABEL.en;
}

/** The browser voice tag for the language the user selected. Not the typed script. */
export function voiceTag(lang: AppLang): string {
  return speechLang(lang);
}

/** Prefer an exact locale voice, then the same language. Never a random other language. */
export function pickVoice<T extends VoiceLike>(voices: T[], tag: string): T | null {
  const want = tag.toLowerCase();
  const prefix = want.split("-")[0] || want;
  return (
    voices.find((voice) => voice.lang.toLowerCase() === want) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix + "-")) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) ||
    null
  );
}

/** Word under a speech boundary, so the line can highlight what is being read. */
export function spokenSlice(text: string, charIndex: number, charLength: number): { start: number; end: number } {
  const start = Math.max(0, Math.min(charIndex, text.length));
  if (charLength > 0) {
    return { start, end: Math.min(text.length, start + charLength) };
  }
  const rest = text.slice(start);
  const word = /^\s*\S+/.exec(rest);
  return { start, end: Math.min(text.length, start + (word ? word[0].length : 0)) };
}
