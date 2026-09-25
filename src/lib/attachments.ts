export const MAX_PNG_BYTES = 1_500_000;
export const MAX_TEXT_CHARS = 12_000;

const TEXT_EXT = new Set(["txt", "md", "csv", "json", "text"]);

export type IncomingAttachment = {
  name?: unknown;
  kind?: unknown;
  text?: unknown;
  dataUrl?: unknown;
};

export type ReadyAttachment =
  | { kind: "text"; name: string; text: string }
  | { kind: "png"; name: string; dataUrl: string }
  | { kind: "image"; name: string; dataUrl: string };

export type AttachmentResult =
  | { ok: true; attachment: null }
  | { ok: true; attachment: ReadyAttachment }
  | { ok: false; error: string };

function cleanName(raw: unknown): string {
  const base = String(raw ?? "file")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^\w.\- ()[\]]+/g, "")
    .slice(0, 80);
  return base && base !== "." && base !== ".." ? base : "file";
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function pngBytes(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const b64 = match[1].replace(/\s/g, "");
  if (!b64 || b64.length % 4 === 1) return null;
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return null;
  }
  if (binary.length < 8 || binary.length > MAX_PNG_BYTES) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i += 1) {
    if (bytes[i] !== sig[i]) return null;
  }
  return bytes;
}

function imageBytes(dataUrl: string): boolean {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return false;
  const mime = match[1].toLowerCase();
  const b64 = match[2].replace(/\s/g, "");
  if (!b64 || b64.length % 4 === 1) return false;
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return false;
  }
  if (binary.length < 12 || binary.length > MAX_PNG_BYTES) return false;
  const bytes = Array.from({ length: 12 }, (_, i) => binary.charCodeAt(i));
  if (mime === "png") return bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  if (mime === "jpeg" || mime === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && binary.slice(8, 12) === "WEBP";
}

export function parseAttachment(raw: unknown): AttachmentResult {
  if (raw == null) return { ok: true, attachment: null };
  if (typeof raw !== "object") return { ok: false, error: "Attachment must be an object." };
  const body = raw as IncomingAttachment;
  const name = cleanName(body.name);
  const kind = String(body.kind ?? "").toLowerCase();
  const ext = extOf(name);

  if (kind === "png" || (!kind && ext === "png")) {
    if (typeof body.dataUrl !== "string") return { ok: false, error: "PNG data is missing." };
    if (!pngBytes(body.dataUrl)) {
      return { ok: false, error: "Only a real PNG under 1.5 MB is allowed." };
    }
    return { ok: true, attachment: { kind: "png", name: ext === "png" ? name : `${name}.png`, dataUrl: body.dataUrl.trim() } };
  }

  if (kind === "image") {
    if (typeof body.dataUrl !== "string" || !imageBytes(body.dataUrl)) {
      return { ok: false, error: "Use a photo under 1.5 MB. JPG, PNG, or WEBP." };
    }
    return { ok: true, attachment: { kind: "image", name, dataUrl: body.dataUrl.trim() } };
  }

  if (kind === "text" || (!kind && TEXT_EXT.has(ext))) {
    if (ext && !TEXT_EXT.has(ext)) {
      return { ok: false, error: "Only PNG images or text files (.txt, .md, .csv, .json) are allowed." };
    }
    if (typeof body.text !== "string") return { ok: false, error: "Text file is empty." };
    if (body.text.includes("\u0000")) return { ok: false, error: "Binary files are not allowed." };
    const text = body.text.replace(/^\uFEFF/, "").slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) return { ok: false, error: "Text file is empty." };
    const safeExt = TEXT_EXT.has(ext) ? ext : "txt";
    const safeName = TEXT_EXT.has(ext) ? name : `${name}.${safeExt}`;
    return { ok: true, attachment: { kind: "text", name: safeName, text } };
  }

  return { ok: false, error: "Only PNG images or text files (.txt, .md, .csv, .json) are allowed." };
}

export function modelPrompt(query: string, attachment: ReadyAttachment | null): string {
  const ask = query.trim();
  if (!attachment) return ask;
  if (attachment.kind === "text") {
    const head = ask || "Read the attached text and answer if it relates to Indian Standards or BIS services.";
    return `${head}\n\nATTACHED TEXT FILE (${attachment.name}):\n${attachment.text}`;
  }
  return ask || "Read the attached PNG. If it shows a product, IS number, ISI, CRS, or hallmark, say what you can actually see. Do not invent an IS number.";
}

export function retrievalText(query: string, attachment: ReadyAttachment | null): string {
  if (attachment?.kind === "text") {
    return `${query}\n${attachment.text}`.trim().slice(0, 2000);
  }
  const typed = query.trim();
  return typed || "Indian Standard product label";
}
