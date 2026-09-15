import { isAppLang, type AppLang } from "@/lib/language";

const KEY = "mm_lang";
const EVENT = "mm-lang";

let current: AppLang = "en";

if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isAppLang(stored)) current = stored;
  } catch {
    /* ignore */
  }
}

export function getLangSnapshot(): AppLang {
  return current;
}

export function getLangServerSnapshot(): AppLang {
  return "en";
}

export function setLang(next: AppLang) {
  current = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function initLang() {
  let next: AppLang = "en";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (isAppLang(stored)) next = stored;
  } catch {
    next = "en";
  }
  current = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
}

export function subscribeLang(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
