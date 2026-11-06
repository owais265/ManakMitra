import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readDocxBytes, readPdfBytes, groundFileAnswer } from "../src/lib/file-text.ts";
import { guardFileSpoken } from "../src/lib/answer-guard.ts";

function zipDocx(xml) {
  const name = "word/document.xml";
  const data = Buffer.from(xml);
  const comp = deflateRawSync(data);
  const localName = Buffer.from(name);
  const local = Buffer.alloc(30 + localName.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(localName.length, 26);
  localName.copy(local, 30);
  const localOff = 0;
  const central = Buffer.alloc(46 + localName.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(localName.length, 28);
  central.writeUInt32LE(localOff, 42);
  localName.copy(central, 46);
  const centralOff = local.length + comp.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOff, 16);
  return Buffer.concat([local, comp, central, eocd]);
}

const xml =
  "<w:document><w:p><w:r><w:t>BIS internship stipend is ₹25,000 per four weeks. CMED/CC January 2024.</w:t></w:r></w:p></w:document>";
const docx = zipDocx(xml);
const read = readDocxBytes(docx, "scheme.docx");
assert.equal(read.ok, true);
assert.match(read.file.text, /25,000/);
assert.match(read.file.text, /READ: complete/);
assert.equal(read.file.complete, true);

const empty = readDocxBytes(zipDocx("<w:document></w:document>"), "empty.docx");
assert.equal(empty.ok, false);
assert.match(empty.error, /Nothing was guessed/);

const junkPdf = await readPdfBytes(Buffer.from("%PDF-1.4\nnot a real body"), "nope.pdf");
assert.equal(junkPdf.ok, false);
assert.match(junkPdf.error, /Nothing was guessed/);

const poisoned =
  "The attached file says the stipend is ₹25,000 and also names IS 99999. Catalogue fee ₹1 for cement.";
const guarded = guardFileSpoken(poisoned, read.file.text, "IS 14543 water");
assert.match(guarded, /25,000/);
assert.doesNotMatch(guarded, /99999/);
assert.match(guarded, /not in the attached file/);

const dumped = "IS 1391 air conditioner. Hypothetical / policy scenario — pack has no SOP.";
const grounded = groundFileAnswer(
  'Quote the part that includes "25,000".',
  read.file.text,
  dumped,
);
assert.match(grounded, /25,000/);
assert.doesNotMatch(grounded, /1391/);
assert.doesNotMatch(grounded, /pack has no SOP/);

console.log("file-text tests passed");
