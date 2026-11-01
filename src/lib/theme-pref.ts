import { createServerFn } from "@tanstack/react-start";

export const THEME_COOKIE = "mm_theme";

export function themeCookie(dark: boolean) {
  return `${THEME_COOKIE}=${dark ? "dark" : "light"}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export const readThemeDark = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  return getCookie(THEME_COOKIE) === "dark";
});
