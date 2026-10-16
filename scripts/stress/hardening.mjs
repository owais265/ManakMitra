import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const base = process.env.STRESS_BASE || "http://127.0.0.1:8080";
const lines = [];
function row(name, pass, detail) {
  lines.push(`| ${name} | ${pass ? "pass" : "fail"} | ${detail} |`);
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function chat(page, query, extraHeaders = {}) {
  const t0 = Date.now();
  const res = await page.request.post(`${base}/api/chat`, {
    headers: { "Content-Type": "application/json", ...extraHeaders },
    data: { query },
    timeout: 60_000,
  });
  const body = await res.text();
  return { status: res.status(), ms: Date.now() - t0, body, retry: res.headers()["retry-after"] || "" };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const healthT = Date.now();
const health = await page.request.get(`${base}/api/health`);
const healthMs = Date.now() - healthT;
const healthBody = await health.text();
row("E health", health.status() === 200 && healthMs < 300 && healthBody.includes('"ok":true'), `${health.status()} ${healthMs}ms ${healthBody.slice(0, 80)}`);

const isq = await chat(page, "What is IS 14543?");
row(
  "A IS 14543",
  isq.status === 200 && /14543/.test(isq.body) && /bis\.gov\.in|services\.bis\.gov\.in|standards\.bis\.gov\.in/i.test(isq.body),
  `${isq.status} ${isq.ms}ms`,
);
const isq2 = await chat(page, "What is IS 14543?");
row("C cache second", isq2.status === 200 && isq2.ms <= isq.ms + 50, `first ${isq.ms}ms second ${isq2.ms}ms`);
const other = await chat(page, "What is IS 302?");
row("C cache other", other.status === 200, `${other.status} ${other.ms}ms`);

const fee = await chat(page, "What is the fee for a BIS licence?");
row("A fee refuse", fee.status === 200 && !/₹\s*\d{3,}|rs\.?\s*\d{3,}/i.test(fee.body), `${fee.status} ${fee.ms}ms`);

const cake = await chat(page, "recipe for cake");
row("A offtopic", cake.status === 200 && /not a general|outside|Indian Standards|catalogue|BIS/i.test(cake.body), `${cake.status} ${cake.ms}ms`);

const labsCity = await page.request.post(`${base}/api/labs`, {
  data: { pin: "Hyderabad", kind: "lab" },
});
const labsCityBody = await labsCity.text();
row("A labs city", labsCity.status() === 400 && /6-digit PIN/.test(labsCityBody), `${labsCity.status()} ${labsCityBody.slice(0, 80)}`);

const labsPin = await page.request.post(`${base}/api/labs`, {
  data: { pin: "500001", kind: "lab" },
});
const labsPinBody = await labsPin.text();
row(
  "A labs pin",
  labsPin.status() === 200 && !/I guess|probably the nearest/.test(labsPinBody),
  `${labsPin.status()} ${labsPin.headers()["content-type"] || ""}`,
);

let okCount = 0;
let limited = 0;
let retryAfter = false;
for (let i = 0; i < 25; i += 1) {
  const res = await page.request.post(`${base}/api/chat`, {
    headers: { "x-forwarded-for": "203.0.113.50" },
    data: { query: "recipe for cake" },
  });
  if (res.status() === 429) {
    limited += 1;
    if (res.headers()["retry-after"]) retryAfter = true;
  } else okCount += 1;
}
row("B rate limit", okCount === 20 && limited === 5 && retryAfter, `ok=${okCount} limited=${limited} retryAfter=${retryAfter}`);

await page.goto(`${base}/`, { waitUntil: "networkidle" });
const menu = page.getByRole("button", { name: /menu/i });
if (await menu.count()) await menu.first().click();
await page.screenshot({ path: "/tmp/stress-home-390.png" });
const overlap = await page.evaluate(() => {
  const hero = document.querySelector("h1");
  const panel = document.querySelector("[role='dialog'], nav, [data-menu]");
  if (!hero) return "no-h1";
  const hb = hero.getBoundingClientRect();
  if (!panel) return `hero y=${Math.round(hb.top)} h=${Math.round(hb.height)}`;
  const pb = panel.getBoundingClientRect();
  const hit = !(hb.bottom < pb.top || hb.top > pb.bottom || hb.right < pb.left || hb.left > pb.right);
  return hit ? "overlap" : "clear";
});
row("E phone menu", overlap !== "overlap" && overlap !== "no-h1", overlap);

await page.goto(`${base}/contact`, { waitUntil: "networkidle" });
const contact = await page.locator("body").innerText();
row("E contact", contact.includes("complaints@bis.gov.in"), contact.includes("complaints@bis.gov.in") ? "line present" : "missing");

await browser.close();
const md = ["# Stress hardening", "", "| Case | Result | Detail |", "|---|---|---|", ...lines, ""].join("\n");
writeFileSync("/tmp/stress-rows.md", md);
console.log(md);
