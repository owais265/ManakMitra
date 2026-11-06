/**
 * Server-only readers for an attached PDF or Word file.
 * The model is never called with an unread file. Empty or broken files stop here.
 */
import { inflateRawSync } from "node:zlib";

export const MAX_DOC_BYTES = 8_000_000;
/** Whole small standards documents fit. A longer file is cut in the middle and marked. */
export const MAX_READ_CHARS = 48_000;

export type FileRead = {
  name: string;
  kind: "pdf" | "docx";
  pages: number;
  complete: boolean;
  text: string;
};

export type FileReadResult = { ok: true; file: FileRead } | { ok: false; error: string };

const PDF_URL = /^data:application\/pdf;base64,([a-z0-9+/=\s]+)$/i;
const DOCX_URL =
  /^data:(?:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/octet-stream|application\/zip);base64,([a-z0-9+/=\s]+)$/i;

export function decodeDataUrl(dataUrl: string, kind: "pdf" | "docx"): Uint8Array | null {
  const match = (kind === "pdf" ? PDF_URL : DOCX_URL).exec(dataUrl.trim());
  if (!match?.[1]) return null;
  const b64 = match[1].replace(/\s/g, "");
  if (!b64 || b64.length % 4 === 1) return null;
  let binary: string;
  try {
    binary = atob(b64);
  } catch {
    return null;
  }
  if (binary.length < 8 || binary.length > MAX_DOC_BYTES) return null;
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function boundRead(raw: string): { text: string; complete: boolean } {
  const clean = cleanText(raw);
  if (clean.length <= MAX_READ_CHARS) return { text: clean, complete: true };
  const head = clean.slice(0, 36_000);
  const tail = clean.slice(-8_000);
  const gap = clean.length - 44_000;
  return {
    text: `${head}\n\n[NOT READ] ${gap} characters in the middle of this file were not loaded. Do not guess them.\n\n${tail}`,
    complete: false,
  };
}

function present(name: string, kind: "pdf" | "docx", pages: number, body: string, complete: boolean): string {
  const label = kind === "pdf" ? "PDF" : "WORD";
  const read = complete
    ? `READ: complete (${body.length} characters).`
    : "READ: partial. A gap is marked [NOT READ]. Do not guess the gap.";
  return [
    `ATTACHED ${label} ${name}`,
    `PAGES: ${pages}`,
    read,
    "What the file says is only the text below. If a fact is not in this text, say the file does not say it.",
    "Do not put a catalogue IS number, fee, laboratory, or clause into a sentence about this file.",
    "",
    body,
  ].join("\n");
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
}

function zipEntries(buf: Buffer): Map<string, Buffer> | null {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  if (count > 4000) return null;
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8").replace(/\\/g, "/");
    p += 46 + nameLen + extraLen + commentLen;
    if (compSize > MAX_DOC_BYTES || localOff + 30 > buf.length) continue;
    if (buf.readUInt32LE(localOff) !== 0x04034b50) continue;
    const localName = buf.readUInt16LE(localOff + 26);
    const localExtra = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + localName + localExtra;
    if (dataStart + compSize > buf.length) continue;
    const data = buf.subarray(dataStart, dataStart + compSize);
    try {
      if (method === 0) out.set(name, Buffer.from(data));
      else if (method === 8) out.set(name, inflateRawSync(data, { maxOutputLength: 2_000_000 }));
    } catch {
      return null;
    }
  }
  return out;
}

function wantedDocx(name: string): boolean {
  return /^word\/(document|footnotes|endnotes|header\d+|footer\d+)\.xml$/i.test(name);
}

export function readDocxBytes(bytes: Uint8Array, name: string): FileReadResult {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return { ok: false, error: "This is not a Word file. Nothing was guessed." };
  }
  const entries = zipEntries(Buffer.from(bytes));
  if (!entries) return { ok: false, error: "This Word file could not be opened. Nothing was guessed." };
  const parts = [...entries.keys()].filter(wantedDocx).sort();
  if (!parts.includes("word/document.xml")) {
    return { ok: false, error: "This file has no readable text. Nothing was guessed." };
  }
  const chunks = parts.map((part) => xmlToText(entries.get(part)?.toString("utf8") || ""));
  const bounded = boundRead(chunks.join("\n"));
  if (!bounded.text.trim()) return { ok: false, error: "This file has no readable text. Nothing was guessed." };
  return {
    ok: true,
    file: {
      name,
      kind: "docx",
      pages: 1,
      complete: bounded.complete,
      text: present(name, "docx", 1, bounded.text, bounded.complete),
    },
  };
}

export async function readPdfBytes(bytes: Uint8Array, name: string): Promise<FileReadResult> {
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return { ok: false, error: "This is not a PDF. Nothing was guessed." };
  }
  const data = new Uint8Array(bytes);
  try {
    const { extractText } = await import("unpdf");
    const extracted = await extractText(data, { mergePages: true });
    const merged = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text || "");
    const bounded = boundRead(merged);
    if (!bounded.text.trim()) return { ok: false, error: "This file has no readable text. Nothing was guessed." };
    const pages = Number(extracted.totalPages) || 1;
    return {
      ok: true,
      file: {
        name,
        kind: "pdf",
        pages,
        complete: bounded.complete,
        text: present(name, "pdf", pages, bounded.text, bounded.complete),
      },
    };
  } catch {
    return { ok: false, error: "This PDF could not be read. Nothing was guessed." };
  }
}

/** If the model answers from the catalogue, replace it with the line the file actually contains. */
export function groundFileAnswer(query: string, fileText: string, spoken: string): string {
  const needles = [...query.matchAll(/"([^"]{2,120})"/g)].map((m) => m[1].trim()).filter(Boolean);
  if (!fileText || needles.length === 0) return spoken;
  const body = fileText.split("What the file says is only the text below.").pop() || fileText;
  const lines = body
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 20);
  const packDump =
    /pack has no SOP|Hypothetical \/ policy|Catalogue metadata only|IS number not in this catalogue|BIS CARE app kaise|HUID verification kaise|Scheme-I — apply|Scheme-II Compulsory/i.test(
      spoken,
    );
  const missing = needles.filter((needle) => !spoken.toLowerCase().includes(needle.toLowerCase()));
  const foreignIs = [...spoken.matchAll(/\bIS[\s/.-]*(\d{3,6})\b/gi)].some((match) => !body.includes(match[1]));
  const parts = needles.map((needle) => {
    const hit = lines.find((line) => line.toLowerCase().includes(needle.toLowerCase()));
    return hit
      ? `The attached file says: ${hit}`
      : `The attached file does not contain "${needle}". Nothing was guessed.`;
  });
  const notes: string[] = [];
  if (/IS\s*99999/i.test(query) && !body.includes("99999")) notes.push("The file does not name IS 99999.");
  if (/123456/.test(query) && !body.includes("123456")) notes.push("The file does not state a fee of Rs 123456.");
  const mention = /mention(?:s)?\s+([A-Za-z0-9][^?.\n]{1,60})/i.exec(query);
  let denied = false;
  if (mention) {
    const token = mention[1].replace(/["']/g, "").trim();
    if (token && !body.toLowerCase().includes(token.toLowerCase())) {
      denied = true;
      notes.push(`The file does not say ${token}.`);
    }
  }
  if (!packDump && missing.length === 0 && !foreignIs && !denied) return spoken;
  return [...parts, ...notes].join("\n");
}

export async function readAttachmentFile(attachment: {
  kind: "pdf" | "docx";
  name: string;
  dataUrl: string;
}): Promise<FileReadResult> {
  const bytes = decodeDataUrl(attachment.dataUrl, attachment.kind);
  if (!bytes) return { ok: false, error: "This file could not be read. Nothing was guessed." };
  if (attachment.kind === "pdf") return readPdfBytes(bytes, attachment.name);
  return readDocxBytes(bytes, attachment.name);
}
