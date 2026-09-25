import assert from "node:assert/strict";
import { parseAttachment, modelPrompt, retrievalText } from "../src/lib/attachments.ts";

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const pngUrl = `data:image/png;base64,${PNG_SIG.toString("base64")}`;
const jpegUrl = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString("base64")}`;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  if (passed % 100 === 0) console.log(`ok ${passed} ${name}`);
}

check("no attachment", () => {
  assert.deepEqual(parseAttachment(undefined), { ok: true, attachment: null });
  assert.deepEqual(parseAttachment(null), { ok: true, attachment: null });
});

check("plain text", () => {
  const r = parseAttachment({ name: "note.txt", kind: "text", text: "IS 269 cement" });
  assert.equal(r.ok, true);
  assert.equal(r.attachment.kind, "text");
  assert.match(modelPrompt("which IS?", r.attachment), /IS 269 cement/);
  assert.match(retrievalText("which IS?", r.attachment), /IS 269/);
});

check("md csv json by extension", () => {
  for (const name of ["a.md", "b.csv", "c.json", "d.text"]) {
    const r = parseAttachment({ name, text: "hallmark HUID" });
    assert.equal(r.ok, true, name);
    assert.equal(r.attachment.kind, "text");
  }
});

check("png magic", () => {
  const r = parseAttachment({ name: "label.png", kind: "png", dataUrl: pngUrl });
  assert.equal(r.ok, true);
  assert.equal(r.attachment.kind, "png");
  assert.match(modelPrompt("", r.attachment), /attached PNG/i);
  assert.equal(retrievalText("", r.attachment), "Indian Standard product label");
});

check("reject jpeg pdf svg html exe zip gif webp", () => {
  const bad = [
    { name: "a.jpg", kind: "png", dataUrl: jpegUrl },
    { name: "a.pdf", kind: "pdf", text: "x" },
    { name: "a.svg", text: "<svg>" },
    { name: "a.html", text: "<script>" },
    { name: "a.exe", kind: "text", text: "MZ" },
    { name: "a.zip", text: "PK" },
    { name: "a.gif", kind: "image", dataUrl: pngUrl },
    { name: "a.webp", kind: "png", dataUrl: "data:image/webp;base64,AAA=" },
  ];
  for (const item of bad) {
    const r = parseAttachment(item);
    assert.equal(r.ok, false, item.name);
  }
});

check("reject empty binary huge path traversal", () => {
  assert.equal(parseAttachment({ name: "a.txt", kind: "text", text: "   " }).ok, false);
  assert.equal(parseAttachment({ name: "a.txt", kind: "text", text: "ok\u0000bad" }).ok, false);
  assert.equal(parseAttachment({ name: "a.png", kind: "png", dataUrl: "data:image/png;base64,!!!!" }).ok, false);
  assert.equal(parseAttachment("nope").ok, false);
  const sneaky = parseAttachment({ name: "../../etc/passwd.txt", kind: "text", text: "IS 1" });
  assert.equal(sneaky.ok, true);
  assert.equal(sneaky.attachment.name.includes("/"), false);
  assert.equal(sneaky.attachment.name.includes(".."), false);
});

check("png without signature rejected even if kind png", () => {
  const fake = `data:image/png;base64,${Buffer.from("not a png!!").toString("base64")}`;
  assert.equal(parseAttachment({ name: "x.png", kind: "png", dataUrl: fake }).ok, false);
});

const exts = ["txt", "md", "csv", "json", "text"];
const junkExts = ["pdf", "doc", "docx", "jpg", "jpeg", "gif", "webp", "svg", "html", "js", "exe", "zip", "png"];
for (let i = 0; i < 250; i += 1) {
  const ext = exts[i % exts.length];
  const text = `Row ${i} IS ${1000 + i} cement hallmark`;
  check(`text case ${i}`, () => {
    const r = parseAttachment({ name: `file ${i}.${ext}`, text });
    assert.equal(r.ok, true);
    assert.equal(r.attachment.text.includes(`IS ${1000 + i}`), true);
    const prompt = modelPrompt(i % 2 ? "" : `ask ${i}`, r.attachment);
    assert.match(prompt, new RegExp(`IS ${1000 + i}`));
  });
}

for (let i = 0; i < 200; i += 1) {
  const ext = junkExts[i % junkExts.length];
  check(`reject case ${i}`, () => {
    const r = parseAttachment({
      name: `bad-${i}.${ext}`,
      kind: "png",
      dataUrl: i % 2 === 0 ? jpegUrl : "data:image/png;base64,AAAA",
    });
    assert.equal(r.ok, false, ext);
  });
}

for (let i = 0; i < 50; i += 1) {
  check(`png pad ${i}`, () => {
    const extra = Buffer.concat([PNG_SIG, Buffer.alloc(16 + i, i)]);
    const url = `data:image/png;base64,${extra.toString("base64")}`;
    const r = parseAttachment({ name: `shot-${i}.PNG`, kind: "png", dataUrl: url });
    assert.equal(r.ok, true);
    assert.equal(retrievalText(`label ${i}`, r.attachment), `label ${i}`);
  });
}

console.log(`attachments tests passed: ${passed}`);
if (passed < 500) {
  console.error(`expected at least 500 checks, got ${passed}`);
  process.exit(1);
}
