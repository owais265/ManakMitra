import { createFileRoute } from "@tanstack/react-router";
import { isAppLang, speechLang } from "@/lib/language";
import { clientIp, takeLimit } from "@/lib/rate-limit";

const MAX = 180;

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = takeLimit(`speak:${clientIp(request)}`, Date.now(), 48, 60_000);
        if (!gate.ok) {
          return new Response("Too many requests.", {
            status: 429,
            headers: { "Retry-After": String(gate.retryAfter) },
          });
        }
        let body: { lang?: string; text?: string };
        try {
          body = (await request.json()) as { lang?: string; text?: string };
        } catch {
          return new Response("Send JSON.", { status: 400 });
        }
        const lang = isAppLang(body.lang) ? body.lang : null;
        const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, MAX);
        if (!lang || !text) return new Response("Need a language and text.", { status: 400 });
        const tl = speechLang(lang).split("-")[0] || "en";
        const url =
          "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" +
          encodeURIComponent(tl) +
          "&q=" +
          encodeURIComponent(text);
        const upstream = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://translate.google.com/",
          },
        });
        if (!upstream.ok) return new Response("Voice unavailable.", { status: 502 });
        const bytes = await upstream.arrayBuffer();
        if (bytes.byteLength < 32) return new Response("Voice unavailable.", { status: 502 });
        return new Response(bytes, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
