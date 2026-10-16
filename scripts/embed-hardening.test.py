import importlib.util
import json
import os
import tempfile
import time
from pathlib import Path

ROOT = Path("/workspace/scripts/embed-remaining.py")
spec = importlib.util.spec_from_file_location("embed_remaining", ROOT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def test_backoff_retries_57014_and_returns():
    calls = {"n": 0}

    def flaky(_n):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError('fetch 500 {"code":"57014","message":"canceling statement due to statement timeout"}')
        return [{"id": "a", "text": "t"}]

    slept = []
    rows = mod.fetch_with_backoff(16, fetch_fn=flaky, sleep_fn=lambda s: slept.append(s))
    assert rows[0]["id"] == "a"
    assert calls["n"] == 3
    assert slept == [0.4, 0.8]


def test_non_timeout_does_not_retry():
    calls = {"n": 0}

    def boom(_n):
        calls["n"] += 1
        raise RuntimeError("fetch 500 other")

    try:
        mod.fetch_with_backoff(16, fetch_fn=boom, sleep_fn=lambda _s: None)
        raise SystemExit("should have raised")
    except RuntimeError as e:
        assert "other" in str(e)
    assert calls["n"] == 1


def test_quota_exit():
    cool = {str(i): time.time() + 10_000 for i in range(len(mod.KEYS) or 12)}
    fd, name = tempfile.mkstemp(suffix=".json")
    os.close(fd)
    Path(name).write_text(json.dumps(cool))
    prev = mod.CURSOR
    mod.CURSOR = Path(name)
    try:
        status = mod.main()
    finally:
        mod.CURSOR = prev
        Path(name).unlink(missing_ok=True)
    assert status == "quota", status


if __name__ == "__main__":
    test_backoff_retries_57014_and_returns()
    test_non_timeout_does_not_retry()
    test_quota_exit()
    print("embed-hardening ok")
