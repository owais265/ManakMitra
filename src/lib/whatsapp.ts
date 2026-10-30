import { createHmac, timingSafeEqual } from "node:crypto";
import { isOfficialHost } from "./official-hosts.ts";

export type WaInbound = {
  from: string;
  phoneNumberId: string;
  messageId: string;
  text: string | null;
  kind: "text" | "other";
};

const SITE = "https://forest-yonder-apex-plum.vercel.app/chat";

/** Off unless explicitly turned on after Meta business verification. */
export function whatsappEnabled(flag: string | undefined): boolean {
  const value = flag?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

/** Env only. A missing or short value fails closed. There is no source fallback. */
export function expectedVerifyToken(envValue: string | undefined): string {
  const fromEnv = envValue?.trim() ?? "";
  return fromEnv.length >= 8 ? fromEnv : "";
}

/** Chat-quota bypass. This secret is not the Meta verify token. */
export function acceptInternalHeader(header: string | null, secret: string | undefined): boolean {
  const key = secret?.trim() ?? "";
  if (key.length < 8 || !header) return false;
  const given = Buffer.from(header);
  const want = Buffer.from(key);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

function hubValue(params: URLSearchParams, dotted: string, underscored: string): string | null {
  return params.get(dotted) || params.get(underscored);
}

function hasHub(params: URLSearchParams): boolean {
  return Boolean(
    hubValue(params, "hub.mode", "hub_mode") ||
      hubValue(params, "hub.verify_token", "hub_verify_token") ||
      hubValue(params, "hub.challenge", "hub_challenge"),
  );
}

function addPair(params: URLSearchParams, key: string, value: unknown): void {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text === "string" || typeof text === "number") params.set(key, String(text));
}

function paramsFromJson(raw: string): URLSearchParams | null {
  if (!raw.trim().startsWith("{")) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(record)) addPair(params, key, value);
    const hub = record.hub;
    if (hub && typeof hub === "object" && !Array.isArray(hub)) {
      const nested = hub as Record<string, unknown>;
      if (nested.mode != null) addPair(params, "hub.mode", nested.mode);
      if (nested.verify_token != null) addPair(params, "hub.verify_token", nested.verify_token);
      if (nested.challenge != null) addPair(params, "hub.challenge", nested.challenge);
    }
    return params;
  } catch {
    return null;
  }
}

function paramsFrom(raw: string | null | undefined): URLSearchParams {
  if (!raw) return new URLSearchParams();
  const text = raw.trim();
  if (text.startsWith("{")) return paramsFromJson(text) || new URLSearchParams();
  try {
    if (text.includes("://")) return new URL(text).searchParams;
    if (text.startsWith("/")) return new URL(text, "https://manakmitra.local").searchParams;
  } catch {
    return new URLSearchParams();
  }
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text.replace(/^\?/, "");
  return new URLSearchParams(query);
}

/** Meta's query, plus the headers Vercel keeps when the function URL drops it. */
export function subscribeParams(url: string, headerGet: (name: string) => string | null): URLSearchParams {
  const direct = paramsFrom(url);
  if (hasHub(direct)) return direct;
  const names = ["x-invoke-query", "x-forwarded-uri", "x-vercel-original-url", "x-original-url", "x-forwarded-url"];
  for (const name of names) {
    const parsed = paramsFrom(headerGet(name));
    if (hasHub(parsed)) return parsed;
  }
  return direct;
}

export function verifySubscribe(params: URLSearchParams, expected: string | undefined): string | null {
  const token = expected?.trim();
  if (!token) return null;
  const mode = hubValue(params, "hub.mode", "hub_mode");
  const given = hubValue(params, "hub.verify_token", "hub_verify_token");
  const challenge = hubValue(params, "hub.challenge", "hub_challenge");
  if (mode === "subscribe" && given === token && challenge && challenge.length < 256 && !/[\r\n]/.test(challenge)) {
    return challenge;
  }
  return null;
}

export function checkSignature(raw: string, header: string | null, secret: string | undefined): boolean {
  const key = secret?.trim();
  if (!key) return true;
  if (!header?.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  const mac = createHmac("sha256", key).update(raw).digest();
  if (given.length !== mac.length) return false;
  return timingSafeEqual(given, mac);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function readInbounds(body: unknown): WaInbound[] {
  const root = asRecord(body);
  if (!root || root.object !== "whatsapp_business_account") return [];
  const entries = Array.isArray(root.entry) ? root.entry : [];
  const out: WaInbound[] = [];
  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry)?.changes) ? (asRecord(entry)?.changes as unknown[]) : [];
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value);
      if (!value) continue;
      const phoneNumberId = String(asRecord(value.metadata)?.phone_number_id || "");
      if (!/^\d{6,22}$/.test(phoneNumberId)) continue;
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages) {
        const row = asRecord(message);
        if (!row) continue;
        const from = String(row.from || "");
        const messageId = String(row.id || "");
        if (!/^\d{8,16}$/.test(from) || messageId.length < 6 || messageId.length > 128) continue;
        const text = asRecord(row.text);
        const bodyText = typeof text?.body === "string" ? text.body.replace(/\s+/g, " ").trim().slice(0, 1000) : "";
        if (row.type === "text" && bodyText) {
          out.push({ from, phoneNumberId, messageId, text: bodyText, kind: "text" });
        } else {
          out.push({ from, phoneNumberId, messageId, text: null, kind: "other" });
        }
        if (out.length >= 3) return out;
      }
    }
  }
  return out;
}

export function waLanguage(text: string): "hi" | "en" {
  return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
}

export function photoReply(): string {
  return `WhatsApp par sirf text sawal. Label photo ke liye site kholo: ${SITE}`;
}

/** Drop machine tags. Keep the spoken answer and one official link. */
export function replyFromChat(raw: string): string {
  const lines = raw.split("\n");
  const prose: string[] = [];
  let link = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("[WORK]")) continue;
    if (trimmed.startsWith("[META]") || trimmed.startsWith("[FOLLOW_UP]") || trimmed.startsWith("[PROCESS_STEPS]")) continue;
    if (trimmed.startsWith("[SOURCE]")) {
      const url = trimmed.split("|").map((part) => part.trim())[3] || "";
      if (!link && isOfficialHost(url)) link = url;
      continue;
    }
    prose.push(trimmed);
  }
  let text = prose.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (link && !text.includes(link)) text = text ? `${text}\n${link}` : link;
  if (!text) text = `Is sawal ka catalogue row nahi mila. ${SITE}`;
  return text.slice(0, 3500);
}