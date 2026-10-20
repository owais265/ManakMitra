import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitSql } from "../src/lib/sql-split.ts";
import { sanitizeFeedback } from "../src/lib/feedback-packet.ts";

const packet = sanitizeFeedback({
  kind: "report",
  query: "  cement IS?  ",
  exit: "refuse",
  language: "hi-IN<script>",
  answer: "this essay must not be stored",
  email: "person@example.com",
  locks: [
    { id: "exit", label: "Refuse", detail: "no pack row" },
    ...Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, label: "x", detail: "y" })),
  ],
  evidence: [
    { title: "MANAK", url: "https://www.manakonline.in/path" },
    { title: "search", url: "https://www.google.com/search?q=is" },
    { title: "evil", url: "https://bis.gov.in.evil.test/a" },
    { title: "BIS", link: "https://www.bis.gov.in/standards/" },
  ],
});

assert.ok(packet);
assert.equal(packet.kind, "report");
assert.equal(packet.query, "cement IS?");
assert.equal(packet.language, "hi-IN");
assert.equal(packet.locks.length, 8);
assert.equal(packet.evidence.length, 2);
assert.deepEqual(
  packet.evidence.map((row) => row.url),
  ["https://www.manakonline.in/path", "https://www.bis.gov.in/standards/"],
);
assert.equal("answer" in packet, false);
assert.equal("email" in packet, false);

assert.equal(sanitizeFeedback({ kind: "maybe", query: "x" }), null);
assert.equal(sanitizeFeedback(null), null);
assert.equal(sanitizeFeedback(["up"]), null);

const long = sanitizeFeedback({ kind: "up", query: "q".repeat(800), exit: "e".repeat(500) });
assert.ok(long);
assert.equal(long.query.length, 500);
assert.equal(long.exit.length, 300);

const sql = readFileSync(new URL("../migrations/0003_answer_feedback.sql", import.meta.url), "utf8");
assert.match(sql, /answer_feedback/);
assert.match(sql, /interval '24 hours'/);
assert.match(sql, /enable row level security/);
assert.match(sql, /force row level security/);
assert.match(sql, /revoke all on table public\.answer_feedback from public/);
assert.match(sql, /purge_answer_feedback/);
assert.doesNotMatch(sql, /password/i);

const chat = readFileSync(new URL("../src/components/manakmitra-chat.tsx", import.meta.url), "utf8");
assert.doesNotMatch(chat, /manakmitra-report\.json/);
assert.doesNotMatch(chat, /createObjectURL/);
assert.match(chat, /\/api\/feedback/);

const parts = splitSql(sql);
assert.ok(parts.some((stmt) => /create table if not exists public\.answer_feedback/i.test(stmt)));
const fn = parts.find((stmt) => /purge_answer_feedback\(\)/.test(stmt) && /security definer/i.test(stmt));
assert.ok(fn);
assert.match(fn, /delete from public\.answer_feedback/);
const cron = parts.find((stmt) => stmt.includes("purge-answer-feedback"));
assert.ok(cron);
assert.match(cron, /cron\.schedule/);

console.log("feedback packet checks ok");
