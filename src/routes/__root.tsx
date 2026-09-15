import { useLayoutEffect, useSyncExternalStore } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import {
  subscribeTheme,
  getThemeSnapshot,
  getThemeServerSnapshot,
  initTheme,
} from "@/lib/theme";
import appCss from "../styles.css?url";

const APP_NAME = "ManakMitra BIS Assistant";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1e3a8a" },
      {
        name: "description",
        content:
          "Ask ManakMitra — source-backed assistant for Indian Standards, BIS certification, hallmarking, and recognised labs.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useLayoutEffect(() => {
    initTheme();
  }, []);

  const htmlClass = [
    isChat ? "mm-chat overscroll-none" : "overflow-y-auto",
    dark ? "dark" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('mm_theme')==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.backgroundColor='#0c1222'}var l=localStorage.getItem('mm_lang');if(l)document.documentElement.lang=l}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={
          isChat
            ? "mm-chat antialiased overscroll-none overflow-hidden h-[100dvh] w-full min-w-full bg-white text-slate-900 dark:bg-[#0c1222] dark:text-slate-100"
            : "antialiased min-h-[100dvh] w-full overflow-x-clip overflow-y-auto bg-white text-slate-900 dark:bg-[#0c1222] dark:text-slate-100"
        }
      >
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
