const THEME_KEY = "mm_theme";
const EVENT = "mm-theme";
const DARK_BG = "#0c1222";
const LIGHT_BG = "#ffffff";

export function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function applyTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
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
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function initTheme() {
  let dark = false;
  try {
    dark = window.localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    dark = false;
  }
  applyTheme(dark);
}

export function toggleTheme() {
  applyTheme(!isDarkTheme());
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
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(THEME_KEY) === "dark") return true;
    if (window.localStorage.getItem(THEME_KEY) === "light") return false;
  } catch {
    /* ignore */
  }
  return isDarkTheme();
}

export function getThemeServerSnapshot() {
  return false;
}
