import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";
import { clientIp, takeLimit } from "@/lib/rate-limit";
import {
  checkSignature,
  expectedVerifyToken,
  photoReply,
  readInbounds,
  replyFromChat,
  subscribeParams,
  verifySubscribe,
  waLanguage,
  type WaInbound,
} from "@/lib/whatsapp";

const seen = new Set<string>();

function remember(id: string): boolean {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 400) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return true;
}

async function sendWhatsApp(message: WaInbound, text: string, token: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${message.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: message.from,
      text: { body: text },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) console.error("[wa] send", res.status);
}

async function answerOne(request: Request, message: WaInbound, token: string): Promise<void> {
  const gate = takeLimit(`wa:${message.from}`, Date.now(), 12, 60_000);
  if (!gate.ok) {
    await sendWhatsApp(message, "Bahut messages. Ek minute ruko.", token);
    return;
  }
  if (message.kind !== "text" || !message.text) {
    await sendWhatsApp(message, photoReply(), token);
    return;
  }
  const chatSecret = env("WHATSAPP_CHAT_SECRET");
  const origin = new URL(request.url).origin;
  const chat = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(chatSecret ? { "x-manak-wa": chatSecret } : {}),
    },
    body: JSON.stringify({ query: message.text, language: waLanguage(message.text) }),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await chat.text();
  const reply = chat.ok ? replyFromChat(raw) : "Abhi jawab nahi ban paya. Thodi der baad dobara likho.";
  await sendWhatsApp(message, reply, token);
}

export const Route = createFileRoute("/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = subscribeParams(request.url, (name) => request.headers.get(name));
        const challenge = verifySubscribe(params, expectedVerifyToken(env("WHATSAPP_VERIFY_TOKEN")));
        if (challenge) {
          return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
        const saw = params.get("hub.mode") || params.get("hub_mode") || params.get("hub.verify_token") || params.get("hub_verify_token");
        return new Response(saw ? "bad-token" : "no-query", {
          status: 403,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("ok", { status: 200 });
        const secret = env("WHATSAPP_APP_SECRET");
        if (!checkSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
          return new Response("forbidden", { status: 403 });
        }
        let body: unknown = null;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("ok", { status: 200 });
        }
        const token = env("WHATSAPP_TOKEN");
        if (!token) {
          console.error("[wa] WHATSAPP_TOKEN missing");
          return new Response("ok", { status: 200 });
        }
        const messages = readInbounds(body).filter((message) => remember(message.messageId));
        if (!messages.length) return new Response("ok", { status: 200 });
        console.info("[wa] in", messages.length, "ip", clientIp(request).slice(0, 24));
        for (const message of messages) {
          try {
            await answerOne(request, message, token);
          } catch (err) {
            console.error("[wa] reply", err instanceof Error ? err.message : "fail");
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
