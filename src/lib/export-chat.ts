export type ExportTurn = {
  role: "ai" | "user";
  text: string;
  timestamp?: string;
  sources?: { title: string; link: string }[];
};

const enc = new TextEncoder();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function bytes(...parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >> 8) & 255]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255]);
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = bytes(
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data,
    );
    locals.push(local);
    centrals.push(
      bytes(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ),
    );
    offset += local.length;
  }
  const central = bytes(...centrals);
  const end = bytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  );
  return bytes(...locals, central, end);
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function turns(messages: ExportTurn[]): string[] {
  const lines = ["ManakMitra", ""];
  if (!messages.length) lines.push("No messages.");
  for (const message of messages) {
    const who = message.role === "ai" ? "ManakMitra" : "You";
    lines.push(`${who}${message.timestamp ? ` · ${message.timestamp}` : ""}`);
    lines.push(message.text.trim() || "—");
    for (const source of message.sources || []) {
      if (source.link) lines.push(`${source.title}: ${source.link}`);
    }
    lines.push("");
  }
  return lines;
}

export function buildDocx(messages: ExportTurn[]): Uint8Array {
  const paragraphs = turns(messages)
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`)
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(types) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(document) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(wordRels) },
  ]);
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function buildPdf(pages: { width: number; height: number; rgb: Uint8Array }[]): Promise<Uint8Array> {
  const usable = pages.length ? pages : [{ width: 2, height: 2, rgb: new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]) }];
  const objects: string[] = [];
  const images: Uint8Array[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = usable.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Count ${usable.length} /Kids [${kids}] >>`);
  for (let index = 0; index < usable.length; index += 1) {
    const page = usable[index];
    const pageId = 3 + index * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>`,
    );
    const content = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Im0 Do\nQ\n`;
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    const compressed = await deflate(page.rgb);
    images.push(compressed);
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
    );
  }
  const chunks: Uint8Array[] = [enc.encode("%PDF-1.4\n")];
  const offsets: number[] = [0];
  let cursor = chunks[0].length;
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(cursor);
    const head = enc.encode(`${index + 1} 0 obj\n${objects[index]}`);
    chunks.push(head);
    cursor += head.length;
    const imageIndex = index >= 4 && (index - 4) % 3 === 0 ? (index - 4) / 3 : -1;
    if (imageIndex >= 0) {
      chunks.push(images[imageIndex]);
      cursor += images[imageIndex].length;
      const tail = enc.encode("\nendstream");
      chunks.push(tail);
      cursor += tail.length;
    }
    const end = enc.encode("\nendobj\n");
    chunks.push(end);
    cursor += end.length;
  }
  const xrefAt = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  chunks.push(enc.encode(xref));
  return bytes(...chunks);
}

function wrapLine(text: string, max: number, widthOf: (value: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (widthOf(next) <= max) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

export function paintTranscript(
  messages: ExportTurn[],
  measure: (text: string, font: string) => number,
): { width: number; height: number; commands: { font: string; text: string; x: number; y: number; color: string }[] }[] {
  const width = 794;
  const pageHeight = 1123;
  const max = width - 96;
  const body = "16px Inter, Noto Sans Devanagari, sans-serif";
  const label = "600 13px Inter, Noto Sans Devanagari, sans-serif";
  const pages: { width: number; height: number; commands: { font: string; text: string; x: number; y: number; color: string }[] }[] = [];
  let commands: { font: string; text: string; x: number; y: number; color: string }[] = [];
  let y = 72;
  const nextPage = () => {
    pages.push({ width, height: pageHeight, commands });
    commands = [];
    y = 64;
  };
  const write = (text: string, font: string, color: string) => {
    for (const line of wrapLine(text, max, (value) => measure(value, font))) {
      if (y > pageHeight - 64) nextPage();
      commands.push({ font, text: line, x: 48, y, color });
      y += font === label ? 22 : 26;
    }
  };
  write("ManakMitra", "600 22px Inter, Noto Sans Devanagari, sans-serif", "#0f172a");
  y += 8;
  for (const message of messages) {
    write(`${message.role === "ai" ? "ManakMitra" : "You"}${message.timestamp ? ` · ${message.timestamp}` : ""}`, label, "#1e3a8a");
    write(message.text.trim() || "—", body, "#0f172a");
    for (const source of message.sources || []) {
      if (source.link) write(`${source.title} — ${source.link}`, "13px Inter, Noto Sans Devanagari, sans-serif", "#1d4ed8");
    }
    y += 12;
  }
  if (y < 200) y = 200;
  if (!pages.length) pages.push({ width, height: Math.min(pageHeight, y + 48), commands });
  else pages.push({ width, height: pageHeight, commands });
  return pages;
}

function canvasPages(messages: ExportTurn[]): HTMLCanvasElement[] {
  const scratch = document.createElement("canvas").getContext("2d");
  const pages = paintTranscript(messages, (text, font) => {
    if (!scratch) return text.length * 8;
    scratch.font = font;
    return scratch.measureText(text).width;
  });
  return pages.map((page) => {
    const canvas = document.createElement("canvas");
    canvas.width = page.width;
    canvas.height = page.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, page.width, page.height);
    for (const command of page.commands) {
      ctx.font = command.font;
      ctx.fillStyle = command.color;
      ctx.fillText(command.text, command.x, command.y);
    }
    return canvas;
  });
}

export async function transcriptPng(messages: ExportTurn[]): Promise<Blob> {
  const pages = canvasPages(messages);
  const width = pages[0]?.width || 794;
  const height = pages.reduce((sum, page) => sum + page.height, 0);
  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = Math.max(height, 200);
  const ctx = sheet.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    let top = 0;
    for (const page of pages) {
      ctx.drawImage(page, 0, top);
      top += page.height;
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => sheet.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png");
  return blob;
}

export async function transcriptPdf(messages: ExportTurn[]): Promise<Uint8Array> {
  const pages = canvasPages(messages).map((canvas) => {
    const ctx = canvas.getContext("2d");
    const image = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    const rgb = new Uint8Array(canvas.width * canvas.height * 3);
    if (image) {
      for (let pixel = 0, out = 0; pixel < image.data.length; pixel += 4, out += 3) {
        rgb[out] = image.data[pixel];
        rgb[out + 1] = image.data[pixel + 1];
        rgb[out + 2] = image.data[pixel + 2];
      }
    }
    return { width: canvas.width, height: canvas.height, rgb };
  });
  return buildPdf(pages);
}

export function downloadBytes(data: Blob | Uint8Array, name: string, type: string) {
  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else {
    const copy = new ArrayBuffer(data.byteLength);
    new Uint8Array(copy).set(data);
    blob = new Blob([copy], { type });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
