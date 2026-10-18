import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const { pinCentroid } = jiti(join(root, "src/lib/labs.ts"));
const { rankPublishedPlaces, searchField, labBoard } = jiti(join(root, "src/lib/place-catalogue.server.ts"));
const { checkBrand, checkLicence } = jiti(join(root, "src/lib/verify-cert.ts"));
const { checkHuid } = jiti(join(root, "src/lib/more-desk.ts"));

const bugs = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    bugs.push(`${name}: ${error instanceof Error ? error.message : error}`);
  }
}

const labPins = ["110001", "400001", "600001", "700001", "560001", "500001", "411001", "201301", "122001", "492001", "160059", "226001", "380001", "302001", "462001", "800001", "781001", "440001", "395001", "641001", "141001", "208001", "452001", "360001", "682001"];
const packQueries = ["cement", "helmet", "ceiling fan", "drinking water", "gold jewellery", "laptop charger", "steel tube", "biscuit", "electric cable", "pressure cooker", "PVC pipe", "LED lamp", "packaged water", "ordinary portland", "residual current", "room air conditioner", "domestic gas", "plastic bottle", "safety helmet", "ceiling rose", "food colour", "milk powder", "rubber hose", "aluminium conductor", "IS 14543"];
const licences = ["CM/L-1234567", "R-41000001", "AB12CD", "FAN123", "not-a-mark"];
const brands = ["cement", "ceiling fan", "helmet", "cake mix", "IS 14543", "laptop", "gold ring", "water bottle", "cricket bat", "steel bar"];
const huids = ["AB12CD", "FAN123", "CM/L-1234567", "123456", ""];
const markPins = ["452002", "110001", "400001", "492001", "600001", "700001", "560001", "500001", "411001", "201301", "122001", "380001", "302001", "226001", "800001", "781001", "440001", "395001", "641001", "141001", "208001", "360001", "682001", "160059", "462001"];

for (const pin of labPins) {
  await check(`lab ${pin}`, async () => {
    const origin = pinCentroid(pin);
    assert.ok(origin);
    const rows = await rankPublishedPlaces("lab", origin, pin, "");
    assert.ok(rows.length >= 8, `only ${rows.length}`);
    assert.equal(rows.some((row) => row.id.startsWith("NPL") || row.id.startsWith("NTH-") || row.id.startsWith("CIPET-")), false);
    assert.ok(rows.every((row) => /bis\.gov\.in/.test(row.url || "")));
    assert.equal(rows.every((row) => row.tier === "bis-recognised"), true);
    for (let i = 1; i < Math.min(rows.length, 12); i += 1) assert.ok(rows[i].km >= rows[i - 1].km);
  });
}

await check("delhi has nearby recognised labs", async () => {
  const rows = await rankPublishedPlaces("lab", pinCentroid("110001"), "110001", "");
  assert.ok(rows.filter((row) => row.km <= 80).length >= 8);
});

await check("raipur extract is reachable", async () => {
  const rows = await rankPublishedPlaces("lab", pinCentroid("492001"), "492001", "");
  assert.ok(rows.some((row) => /raipur/i.test(`${row.city} ${row.address}`)));
});

for (const query of packQueries) {
  await check(`pack ${query}`, async () => {
    const field = query.startsWith("IS ") ? "standard" : query === "compulsory registration" ? "process" : "verify";
    const hits = await searchField(query, field);
    assert.ok(hits.length > 0, "no hit");
    assert.ok(hits.every((hit) => /^https:\/\//.test(hit.url)));
    assert.ok(hits.every((hit) => /bis\.gov\.in|manakonline\.in|crsbis\.in|bsbedge\.com|india\.gov\.in/.test(hit.url)));
  });
}

for (const raw of licences) {
  await check(`licence ${raw}`, async () => {
    const verdict = checkLicence(raw);
    assert.ok(verdict.title);
    assert.equal(/\bRs\.?\s*\d{3,}\b/i.test(verdict.detail), false);
    if (raw.startsWith("CM/L-") && raw.length > 10) assert.equal(verdict.status, "format-ok");
    if (raw === "not-a-mark") assert.equal(verdict.status, "invalid");
  });
}

for (const name of brands) {
  await check(`brand ${name}`, async () => {
    const verdict = checkBrand(name);
    assert.ok(verdict.status);
    assert.equal(/\bRs\.?\s*\d{3,}\b/i.test(verdict.detail), false);
    if (name === "cake mix" || name === "cricket bat") assert.equal(verdict.status, "not-found");
    if (name === "IS 14543") assert.ok(verdict.marks.some((mark) => mark.includes("14543")));
  });
}

for (const code of huids) {
  await check(`huid ${code || "empty"}`, async () => {
    const verdict = checkHuid(code);
    if (code === "AB12CD") assert.equal(verdict.status, "ok");
    if (code === "FAN123") assert.equal(verdict.status, "bad");
    if (code === "CM/L-1234567") assert.equal(verdict.status, "licence");
    if (code === "") assert.equal(verdict.status, "empty");
  });
}

for (const pin of markPins) {
  await check(`closed ${pin}`, async () => {
    const origin = pinCentroid(pin);
    assert.ok(origin);
    const rows = await rankPublishedPlaces("hallmark", origin, pin, "");
    assert.ok(rows.length > 0);
    assert.equal(rows.every((row) => row.tier === "closed"), true);
    assert.ok(rows.slice(0, 5).every((row) => /not an open centre/i.test(row.address)));
  });
}

await check("product file water", async () => {
  const hits = await searchField("packaged drinking water", "file");
  assert.ok(hits.length > 0);
});

await check("process crs", async () => {
  const hits = await searchField("compulsory registration", "process");
  assert.ok(hits.length > 0);
});

await check("delhi keeps BIS own and NPL apart", async () => {
  const board = await labBoard(pinCentroid("110001"), "");
  assert.ok(board.nearby.some((row) => row.tier === "bis-own"));
  const npl = [...board.nearby, ...board.farther].find((row) => row.id === "NPL");
  assert.ok(npl);
  assert.equal(npl.tier, "national");
  assert.equal(board.nearby.some((row) => row.tier === "national" && row.tier === "bis-own"), false);
});

await check("hallmark pack rows", async () => {
  const hits = await searchField("hallmark gold", "hallmark");
  assert.ok(hits.length > 0);
  assert.ok(hits.every((hit) => /bis\.gov\.in|manakonline\.in/.test(hit.url)));
});
await check("standards IS 269", async () => {
  const hits = await searchField("IS 269", "standard");
  assert.ok(hits.some((hit) => hit.title.includes("269")));
});

console.log(JSON.stringify({ passed, failed: bugs.length, bugs: bugs.slice(0, 30) }, null, 2));
if (bugs.length) process.exit(1);
