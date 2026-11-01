import { themeCookie } from "./theme-pref.ts";

const THEME_KEY = "mm_theme";
const EVENT = "mm-theme";
const DARK_BG = "#0c1222";
const LIGHT_BG = "#f6f8fa";

let serverHint = false;

/** Called from the root render with the cookie the server already painted. */
export function hintServerTheme(dark: boolean) {
  serverHint = dark;
}

export function isDarkTheme(): boolean {
  if (typeof document === "undefined") return serverHint;
  return document.documentElement.classList.contains("dark");
}

export function applyTheme(dark: boolean, animate = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (animate) root.classList.add("mm-theme-live");
  root.classList.toggle("dark", dark);
  root.style.backgroundColor = dark ? DARK_BG : LIGHT_BG;
  root.style.colorScheme = dark ? "dark" : "light";
  if (document.body) {
    document.body.style.backgroundColor = dark ? DARK_BG : LIGHT_BG;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? DARK_BG : "#1e3a8a");
  try {
    window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    document.cookie = themeCookie(dark);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function initTheme() {
  let dark = serverHint;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") dark = stored === "dark";
  } catch {
    /* keep the server hint */
  }
  applyTheme(dark, false);
}

export function toggleTheme() {
  applyTheme(!isDarkTheme(), true);
}

export function subscribeTheme(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function getThemeSnapshot() {
  if (typeof window === "undefined") return serverHint;
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    /* ignore */
  }
  return isDarkTheme();
}

export function getThemeServerSnapshot() {
  return serverHint;
}
