import assert from "node:assert/strict";
import { buildDocx, buildPdf } from "../src/lib/export-chat.ts";

const docx = buildDocx([
  { role: "user", text: "verify cement", timestamp: "10:00" },
  { role: "ai", text: "IS 269 is the catalogue pin.", sources: [{ title: "MANAK", link: "https://www.manakonline.in" }] },
]);
assert.equal(docx[0], 0x50);
assert.equal(docx[1], 0x4b);
const xml = new TextDecoder().decode(docx);
assert.match(xml, /verify cement/);
assert.match(xml, /IS 269/);
assert.match(xml, /manakonline\.in/);

const pdf = await buildPdf([{ width: 2, height: 2, rgb: new Uint8Array(12).fill(255) }]);
const head = new TextDecoder().decode(pdf.slice(0, 8));
assert.equal(head, "%PDF-1.4");
assert.match(new TextDecoder().decode(pdf), /%%EOF/);
console.log("export checks ok", docx.length, pdf.length);
