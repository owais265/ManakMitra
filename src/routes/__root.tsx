import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
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

  return (
    <html lang="en" className={isChat ? "mm-chat overscroll-none" : "overflow-y-auto"} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className={
          isChat
            ? "mm-chat antialiased overscroll-none overflow-hidden h-[100dvh] w-full min-w-full bg-white"
            : "antialiased min-h-[100dvh] w-full overflow-x-clip overflow-y-auto bg-white text-slate-900"
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
