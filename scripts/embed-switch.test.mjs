import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("embed key switch skips a cooled key and does not stop on a short cool", () => {
  const script = `
import importlib.util, time
spec = importlib.util.spec_from_file_location("embed_remaining", "/workspace/scripts/embed-remaining.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
now = time.time()
n = len(mod.KEYS)
assert n >= 2
cool = {"0": now + 30}
assert mod.next_ready(cool, 0) == 1
both = {"0": now + 40, "1": now + 40}
assert mod.next_ready(both, 0) == 2
dead = {str(i): now + 86400 * 30 for i in range(n)}
assert mod.all_dead(dead) is True
short = {str(i): now + 40 for i in range(n)}
assert mod.all_dead(short) is False
rpm = mod.parse_limit('429 {"error":{"details":[{"retryDelay":"44s","violations":[{"quotaId":"GenerateRequestsPerMinute"}]}]}}')
assert rpm == ("rpm", 44), rpm
daily = mod.parse_limit('429 {"error":{"details":[{"retryDelay":"7200s","violations":[{"quotaId":"GenerateRequestsPerDayPerProject"}]}]}}')
assert daily[0] == "daily" and daily[1] == 7200, daily
assert mod.parse_limit("403 PERMISSION_DENIED")[0] == "dead"
print("ok")
`;
  const run = spawnSync("python3", ["-c", script], { cwd: "/workspace", encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /ok/);
});
