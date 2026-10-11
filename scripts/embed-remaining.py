#!/usr/bin/env python3
"""Fill null pack_docs embeddings, one Gemini key at a time.

Model is gemini-embedding-001, outputDimensionality 768, same space as
existing vectors. Keys are read from .grok/gemini-embed-keys.txt (gitignored).
A key is used until its daily quota or a 403, then the next key. Short 429s
stay on the same key. No key left, or 403 on the last key, stops the job.
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


def fetch(n):
    path = (
        "/rest/v1/pack_docs?select=id,text"
        "&embedding=is.null&order=id.asc&limit=" + str(n)
    )
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
    code, _ = sb(
        "PATCH",
        "/rest/v1/pack_docs?id=eq." + row_id + "&embedding=is.null",
        {"embedding": vec},
        {"Prefer": "return=minimal"},
    )
    return code in (200, 204)


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


def ready_key(cool):
    now = time.time()
    for i in range(len(KEYS)):
        if float(cool.get(str(i), 0)) <= now:
            return i
    return None


def main():
    if not KEYS:
        log("no embed keys")
        return
    cool = load_cool()
    done = 0
    fail = 0
    rpm_streak = {}
    log(f"start one-key keys={len(KEYS)} batch={BATCH} model={MODEL}")
    while True:
        cursor = ready_key(cool)
        if cursor is None:
            wait = min(float(v) for v in cool.values()) - time.time()
            if wait > 900:
                log(f"all keys cooling {int(wait)}s — stop done={done} fail={fail}")
                return
            log(f"all keys cooling {int(max(wait, 1))}s")
            time.sleep(min(max(wait, 1), 60))
            continue
        try:
            rows = fetch(BATCH)
        except Exception as e:
            log("fetch err " + str(e)[:200])
            time.sleep(5)
            continue
        if not rows:
            log(f"complete done={done} fail={fail}")
            return
        vecs, err = embed(KEYS[cursor], [r.get("text") or "" for r in rows])
        if err:
            kind, delay = parse_limit(err)
            if kind == "dead":
                cool[str(cursor)] = time.time() + 86400 * 30
                store_cool(cool)
                log(f"key {cursor + 1}/{len(KEYS)} 403, retired")
                if ready_key(cool) is None:
                    log(f"403 and no keys left — stop done={done} fail={fail}")
                    return
                continue
            if kind == "daily":
                cool[str(cursor)] = time.time() + delay
                store_cool(cool)
                log(f"key {cursor + 1}/{len(KEYS)} daily, next in {delay}s")
                continue
            rpm_streak[cursor] = rpm_streak.get(cursor, 0) + 1
            if rpm_streak[cursor] >= 12:
                cool[str(cursor)] = time.time() + 6 * 3600
                store_cool(cool)
                log(f"key {cursor + 1}/{len(KEYS)} still 429, treat as daily")
                rpm_streak[cursor] = 0
                continue
            log(f"key {cursor + 1}/{len(KEYS)} rpm {delay}s")
            time.sleep(delay)
            continue
        rpm_streak[cursor] = 0
        with ThreadPoolExecutor(max_workers=8) as pool:
            flags = list(pool.map(lambda pair: save(pair[0]["id"], pair[1]), zip(rows, vecs)))
        ok = sum(1 for flag in flags if flag)
        fail += len(flags) - ok
        done += ok
        log(f"done={done} batch_ok={ok}/{len(rows)} fail={fail} key={cursor + 1}/{len(KEYS)}")
        time.sleep(0.05)


if __name__ == "__main__":
    main()
