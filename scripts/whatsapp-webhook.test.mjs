import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  acceptInternalHeader,
  checkSignature,
  expectedVerifyToken,
  photoReply,
  readInbounds,
  replyFromChat,
  subscribeParams,
  verifySubscribe,
  waLanguage,
} from "../src/lib/whatsapp.ts";

const ok = verifySubscribe(
  new URLSearchParams("hub.mode=subscribe&hub.verify_token=desk-token&hub.challenge=12345"),
  "desk-token",
);
assert.equal(ok, "12345");
assert.equal(
  verifySubscribe(new URLSearchParams("hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1"), "desk-token"),
  null,
);
assert.equal(
  verifySubscribe(new URLSearchParams("hub_mode=subscribe&hub_verify_token=desk-token&hub_challenge=77"), "desk-token"),
  "77",
);
assert.equal(
  verifySubscribe(new URLSearchParams("hub.mode=subscribe&hub.verify_token=desk-token&hub.challenge=bad\nline"), "desk-token"),
  null,
);
assert.equal(expectedVerifyToken(undefined), "");
assert.equal(expectedVerifyToken("  "), "");
assert.equal(expectedVerifyToken("short"), "");
assert.equal(expectedVerifyToken("from-env-token"), "from-env-token");
assert.equal(
  verifySubscribe(
    new URLSearchParams("hub.mode=subscribe&hub.verify_token=from-env-token&hub.challenge=998877"),
    expectedVerifyToken(""),
  ),
  null,
);
assert.equal(acceptInternalHeader("chat-secret-value", "chat-secret-value"), true);
assert.equal(acceptInternalHeader("chat-secret-value", "other-secret-value"), false);
assert.equal(acceptInternalHeader("chat-secret-value", ""), false);
assert.equal(acceptInternalHeader(null, "chat-secret-value"), false);
const fromHeader = subscribeParams("https://manakmitra.local/webhook", (name) =>
  name === "x-invoke-query" ? "hub.mode=subscribe&hub.verify_token=desk-token&hub.challenge=42" : null,
);
assert.equal(verifySubscribe(fromHeader, "desk-token"), "42");
const fromJson = subscribeParams("https://manakmitra.local/webhook", (name) =>
  name === "x-vercel-original-url"
    ? JSON.stringify({ hub: { mode: "subscribe", verify_token: "desk-token", challenge: "9" } })
    : null,
);
assert.equal(verifySubscribe(fromJson, "desk-token"), "9");

const raw = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "1234567890" },
            messages: [
              { from: "919999999999", id: "wamid.1", type: "text", text: { body: "cement ISI?" } },
              { from: "919999999999", id: "wamid.2", type: "image" },
            ],
          },
        },
      ],
    },
  ],
});
const rows = readInbounds(JSON.parse(raw));
assert.equal(rows.length, 2);
assert.equal(rows[0].kind, "text");
assert.equal(rows[0].text, "cement ISI?");
assert.equal(rows[1].kind, "other");
assert.equal(readInbounds({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [] } }] }] }).length, 0);

const mac = createHmac("sha256", "app-secret").update(raw).digest("hex");
assert.equal(checkSignature(raw, `sha256=${mac}`, "app-secret"), true);
assert.equal(checkSignature(raw, "sha256=00", "app-secret"), false);
assert.equal(checkSignature(raw, null, undefined), true);

assert.equal(waLanguage("सीमेंट"), "hi");
assert.equal(waLanguage("cement"), "en");

const spoken = replyFromChat(
  [
    "[WORK]{\"kind\":\"step\"}",
    "For cement, the catalogue row is IS 269.",
    "[SOURCE] IS 269 | standard | 2026 | https://www.bis.gov.in/standards",
    "[SOURCE] junk | x | 2026 | https://evil.example/is",
    "[META] high | standards",
    "[FOLLOW_UP] PPC cement",
  ].join("\n"),
);
assert.match(spoken, /IS 269/);
assert.match(spoken, /bis\.gov\.in/);
assert.doesNotMatch(spoken, /evil\.example/);
assert.doesNotMatch(spoken, /\[WORK\]/);
assert.match(photoReply(), /forest-yonder-apex-plum\.vercel\.app\/chat/);
console.log("whatsapp webhook checks ok");
