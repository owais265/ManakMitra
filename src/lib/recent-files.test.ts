import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pushRecent, type RecentFile } from "./recent-files.ts";

describe("pushRecent", () => {
  it("keeps the newest copy of a file and drops a huge image", () => {
    const first = pushRecent([], { name: "mark.png", kind: "png", dataUrl: "data:image/png;base64,abc" });
    const again = pushRecent(first, { name: "mark.png", kind: "png", dataUrl: "data:image/png;base64,xyz" }, 20);
    assert.equal(again.length, 1);
    assert.equal(again[0]?.dataUrl?.endsWith("xyz"), true);
    const huge = pushRecent(again, { name: "big.png", kind: "png", dataUrl: "x".repeat(400_001) });
    assert.equal(huge.length, 1);
    assert.equal((huge[0] as RecentFile).name, "mark.png");
  });
});
