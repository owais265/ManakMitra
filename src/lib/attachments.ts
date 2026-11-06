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
  | { kind: "image"; name: string; dataUrl: string }
  | { kind: "pdf"; name: string; dataUrl: string }
  | { kind: "docx"; name: string; dataUrl: string };

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

function docBytes(dataUrl: string, kind: "pdf" | "docx"): boolean {
  const mime =
    kind === "pdf"
      ? /^data:application\/pdf;base64,([a-z0-9+/=\s]+)$/i
      : /^data:(?:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/octet-stream|application\/zip);base64,([a-z0-9+/=\s]+)$/i;
  const match = mime.exec(dataUrl.trim());
  if (!match?.[1]) return false;
  const b64 = match[1].replace(/\s/g, "");
  if (!b64 || b64.length % 4 === 1 || b64.length > 12_000_000) return false;
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return false;
  }
  if (binary.length < 8 || binary.length > 8_000_000) return false;
  if (kind === "pdf") return binary.startsWith("%PDF-");
  return binary.charCodeAt(0) === 0x50 && binary.charCodeAt(1) === 0x4b && binary.charCodeAt(2) === 3 && binary.charCodeAt(3) === 4;
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
    if (ext && !["png", "jpg", "jpeg", "webp"].includes(ext)) {
      return { ok: false, error: "Use a photo under 1.5 MB. JPG, PNG, or WEBP." };
    }
    if (typeof body.dataUrl !== "string" || !imageBytes(body.dataUrl)) {
      return { ok: false, error: "Use a photo under 1.5 MB. JPG, PNG, or WEBP." };
    }
    return { ok: true, attachment: { kind: "image", name, dataUrl: body.dataUrl.trim() } };
  }

  if (kind === "pdf" || (!kind && ext === "pdf")) {
    if (typeof body.dataUrl !== "string" || !docBytes(body.dataUrl, "pdf")) {
      return { ok: false, error: "Only a real PDF under 8 MB is allowed." };
    }
    return { ok: true, attachment: { kind: "pdf", name: ext === "pdf" ? name : `${name}.pdf`, dataUrl: body.dataUrl.trim() } };
  }

  if (kind === "docx" || (!kind && ext === "docx")) {
    if (typeof body.dataUrl !== "string" || !docBytes(body.dataUrl, "docx")) {
      return { ok: false, error: "Only a real Word file (.docx) under 8 MB is allowed." };
    }
    return { ok: true, attachment: { kind: "docx", name: ext === "docx" ? name : `${name}.docx`, dataUrl: body.dataUrl.trim() } };
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
    return `${head}\n\nATTACHED TEXT FILE (${attachment.name}):\n${attachment.text}\n\nUse this file text for what the file says. Do not add a catalogue IS number, fee, or laboratory into a sentence about the file. If the file does not say it, say so.`;
  }
  if (attachment.kind === "pdf" || attachment.kind === "docx") {
    const head = ask || `Read the attached ${attachment.kind === "pdf" ? "PDF" : "Word file"}.`;
    return `${head}\n\nThe attached ${attachment.kind.toUpperCase()} was not extracted. Say you could not read it. Do not guess its contents. Do not invent an IS number.`;
  }
  const head = ask || (attachment.kind === "png" ? "Read the attached PNG." : "Read the attached image.");
  return `${head}\n\nRead only the attached image pixels. If a licence number, IS number, or hallmark is not visible, say it is not visible. Do not invent one. Do not use a caption from memory.`;
}

export function retrievalText(query: string, attachment: ReadyAttachment | null): string {
  if (attachment?.kind === "text" && attachment.text.length <= 400) {
    return `${query}\n${attachment.text}`.trim().slice(0, 2000);
  }
  const typed = query.trim();
  return typed || "Indian Standard product label";
}
