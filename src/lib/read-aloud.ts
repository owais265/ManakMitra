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

const BREAKS = ["।", "?", "!", ".", "\n", ";", ":"];

/** Short pieces with original offsets, so a remote voice can read the whole reply. */
export function speechChunks(text: string, max = 160): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i] || "")) i += 1;
    if (i >= text.length) break;
    let end = Math.min(text.length, i + max);
    if (end < text.length) {
      const window = text.slice(i, end);
      let cut = -1;
      for (const mark of BREAKS) {
        const at = window.lastIndexOf(mark);
        if (at > 24) cut = Math.max(cut, at);
      }
      if (cut < 0) {
        const space = window.lastIndexOf(" ");
        if (space > 24) cut = space;
      }
      if (cut > 0) end = i + cut + 1;
    }
    out.push({ start: i, end });
    i = end;
  }
  return out;
}

/** Chrome fills the voice list after the first call. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const finish = () => {
      const list = synth.getVoices();
      if (!list.length) return;
      synth.removeEventListener("voiceschanged", finish);
      resolve(list);
    };
    synth.addEventListener("voiceschanged", finish);
    synth.getVoices();
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    }, 350);
  });
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
