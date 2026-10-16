#!/usr/bin/env python3
"""Fill null pack_docs embeddings. One Gemini request at a time.

Round-robin across keys. A short 429 cools only that key. When every key
is on a long cooldown (daily quota or 403), the process exits.
"""
import json
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".grok/supabase.env").read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

BASE = os.environ["SUPABASE_URL"].rstrip("/")
SKEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
KEYS = [
    ln.strip()
    for ln in (ROOT / ".grok/gemini-embed-keys.txt").read_text().splitlines()
    if ln.strip() and not ln.strip().startswith("#")
]
CURSOR = ROOT / ".grok/embed-key-cool.json"
if os.environ.get("EMBED_COOL_PATH"):
    CURSOR = Path(os.environ["EMBED_COOL_PATH"])
MODEL = "gemini-embedding-001"
BATCH = 16
LOG = Path("/tmp/embed_gemini.log")


def log(msg: str) -> None:
    line = time.strftime("%H:%M:%S ") + msg
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def sb(method, path, body=None, headers=None):
    h = {
        "apikey": SKEY,
        "Authorization": "Bearer " + SKEY,
        "Content-Type": "application/json",
    }
    if headers:
        h.update(headers)
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


SKIP = set()
FAILS = {}


def fetch_with_backoff(n, fetch_fn=None, sleep_fn=None):
    call = fetch_fn or fetch
    pause = sleep_fn or time.sleep
    delay = 0.4
    last = None
    for attempt in range(3):
        try:
            return call(n)
        except Exception as e:
            last = e
            if "57014" not in str(e) or attempt == 2:
                raise
            log(f"fetch 57014 retry {attempt + 1}")
            pause(delay)
            delay *= 2
    raise last


def fetch(n):
    path = (
        "/rest/v1/pack_docs?select=id,text"
        "&embedding=is.null&order=id.asc&limit=" + str(n)
    )
    if SKIP:
        path += "&id=not.in.(" + ",".join(sorted(SKIP)) + ")"
    code, data = sb("GET", path)
    if code != 200 or not isinstance(data, list):
        raise RuntimeError(f"fetch {code} {data}")
    return data


def embed(key, texts):
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        + MODEL + ":batchEmbedContents?key=" + key
    )
    reqs = []
    for t in texts:
        t = (t or " ").replace("\x00", " ")[:4000]
        if not t.strip():
            t = " "
        reqs.append({
            "model": "models/" + MODEL,
            "content": {"parts": [{"text": t}]},
            "outputDimensionality": 768,
        })
    req = urllib.request.Request(
        url, data=json.dumps({"requests": reqs}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            data = json.load(r)
        embs = data.get("embeddings") or []
        out = []
        for e in embs:
            vals = e.get("values") or []
            if len(vals) != 768:
                return None, f"bad-dim {len(vals)}"
            out.append(vals)
        if len(out) != len(texts):
            return None, f"count {len(out)}/{len(texts)}"
        return out, None
    except urllib.error.HTTPError as e:
        return None, f"{e.code} {e.read().decode()[:4000]}"


def save(row_id, vec):
    if not isinstance(vec, list) or len(vec) != 768:
        log("skip save bad-dim")
        return False
    last = 0
    for _attempt in range(3):
        try:
            code, body = sb(
                "PATCH",
                "/rest/v1/pack_docs?id=eq." + row_id + "&embedding=is.null",
                {"embedding": vec},
                {"Prefer": "return=representation"},
            )
        except Exception as exc:
            last = 0
            log("save err " + str(exc)[:120])
            time.sleep(0.4)
            continue
        if code in (200, 201) and isinstance(body, list) and body:
            FAILS.pop(row_id, None)
            return True
        last = code if isinstance(code, int) else 0
        if last in (408, 429, 500, 502, 503, 504) or last >= 500:
            time.sleep(0.4)
            continue
        break
    FAILS[row_id] = FAILS.get(row_id, 0) + 1
    if FAILS[row_id] >= 3:
        SKIP.add(row_id)
        log(f"skip save after 3 code={last} skipped={len(SKIP)}")
    else:
        log(f"save fail code={last}")
    return False


def load_cool():
    try:
        data = json.loads(CURSOR.read_text())
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def store_cool(cool):
    CURSOR.write_text(json.dumps(cool))
    CURSOR.chmod(0o600)


def parse_limit(err: str):
    if err.startswith("403") or err.startswith("401") or "PERMISSION_DENIED" in err:
        return "dead", 0
    delay = 40
    daily = False
    try:
        payload = json.loads(err.split(" ", 1)[1])
    except (ValueError, IndexError):
        payload = {}
    for detail in (payload.get("error") or {}).get("details") or []:
        if "retryDelay" in detail:
            raw = str(detail["retryDelay"]).rstrip("s")
            try:
                delay = max(int(float(raw)), 1)
            except ValueError:
                pass
        for violation in detail.get("violations") or []:
            if "PerDay" in str(violation.get("quotaId") or ""):
                daily = True
    low = err.lower()
    if daily or "perday" in low or "per day" in low or "requestsperday" in low or delay > 600:
        return "daily", delay
    return "rpm", min(delay, 90)


def next_ready(cool, start):
    now = time.time()
    for step in range(len(KEYS)):
        i = (start + step) % len(KEYS)
        if float(cool.get(str(i), 0)) <= now:
            return i
    return None


def all_dead(cool):
    now = time.time()
    return all(float(cool.get(str(i), 0)) - now > 86400 * 7 for i in range(len(KEYS)))


def main():
    if not KEYS:
        log("no embed keys")
        return "no-keys"
    cool = load_cool()
    done = 0
    fail = 0
    cursor = 0
    log(f"start round-robin keys={len(KEYS)} batch={BATCH} model={MODEL}")
    while True:
        cursor = next_ready(cool, cursor)
        if cursor is None:
            wait = min(float(cool.get(str(i), 0)) for i in range(len(KEYS))) - time.time()
            if wait > 600 or all_dead(cool):
                log(f"all keys exhausted {int(max(wait, 0))}s — stop done={done} fail={fail}")
                return "quota"
            time.sleep(max(wait, 1))
            cursor = 0
            continue
        try:
            rows = fetch_with_backoff(BATCH)
        except Exception as e:
            log("fetch err " + str(e)[:200])
            time.sleep(5)
            continue
        if not rows:
            log(f"complete done={done} fail={fail}")
            return "complete"
        vecs, err = embed(KEYS[cursor], [r.get("text") or "" for r in rows])
        if err:
            kind, delay = parse_limit(err)
            if kind == "dead":
                cool[str(cursor)] = time.time() + 86400 * 30
                store_cool(cool)
                log(f"key {cursor + 1}/{len(KEYS)} 403 — switch")
            else:
                cool[str(cursor)] = time.time() + delay
                store_cool(cool)
                log(f"key {cursor + 1}/{len(KEYS)} {kind} {delay}s — switch")
            cursor = (cursor + 1) % len(KEYS)
            continue
        with ThreadPoolExecutor(max_workers=8) as pool:
            flags = list(pool.map(lambda pair: save(pair[0]["id"], pair[1]), zip(rows, vecs)))
        ok = sum(1 for flag in flags if flag)
        fail += len(flags) - ok
        done += ok
        log(f"done={done} batch_ok={ok}/{len(rows)} fail={fail} key={cursor + 1}/{len(KEYS)}")
        cursor = (cursor + 1) % len(KEYS)
        time.sleep(0.25)


if __name__ == "__main__":
    while True:
        try:
            status = main()
        except Exception as e:
            log("crash " + str(e)[:300])
            time.sleep(5)
            continue
        if status in ("complete", "dead", "no-keys", "quota"):
            log("exit " + status)
            break
