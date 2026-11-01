import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { themeCookie } from "./theme-pref.ts";

describe("themeCookie", () => {
  it("writes a root cookie the next document can paint before JavaScript", () => {
    assert.equal(themeCookie(true), "mm_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax");
    assert.equal(themeCookie(false).startsWith("mm_theme=light;"), true);
  });
});
