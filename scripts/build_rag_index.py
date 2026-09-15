#!/usr/bin/env python3
"""Build sparse TF-IDF vector pack for ManakMitra RAG. Run from repo root.

Merges authorised public metadata only:
- src/data/bis-index.json
- data/bis_chatbot_knowledge_base.json
- data/manakmitra_bis_knowledge.json (standards URLs + CRS QCO dates; no duplicate rows)
- data/recognised-laboratories.json (OSL validity + labs we do not already have)

Does not ingest synthetic Q&A dumps, QCO year fabrications, or paid IS clause text.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[1]
INDEX_PATH = ROOT / "src" / "data" / "bis-index.json"
OUT_PATH = ROOT / "src" / "data" / "rag-pack.json"
KB_PATH = ROOT / "data" / "bis_chatbot_knowledge_base.json"
KNOWLEDGE_PATH = ROOT / "data" / "manakmitra_bis_knowledge.json"
LABS_PATH = ROOT / "data" / "recognised-laboratories.json"

TOKEN_RE = re.compile(r"[a-z0-9]+|[\u0900-\u097f]+", re.UNICODE)
IS_COMPACT = re.compile(r"[^A-Z0-9]")
CRS_URL = "https://www.crsbis.in/BIS/products-bis.do"
KYS = "https://standards.bis.gov.in/website/know-your-standards"
LIMS = "https://lims.bis.gov.in/home/labs/"
FAQ_URL = "https://www.bis.gov.in/product-certification/product-certification-faq/?lang=en"
CITY_RE = re.compile(
    r"\b(new delhi|navi mumbai|greater noida|raipur|mumbai|delhi|chennai|kolkata|hyderabad|"
    r"bengaluru|bangalore|bengulur|pune|ahmedabad|ahemdabad|ahmadabad|lucknow|jaipur|nagpur|"
    r"nashik|nasik|bhopal|indore|surat|kanpur|patna|chandigarh|guwahati|howrah|dhanbad|"
    r"faridabad|ghaziabad|ludhiana|meerut|ranchi|jodhpur|gwalior|kota|madurai|vadodara|"
    r"bhubaneswar|amritsar|agra|varanasi|rajkot|thane|noida|ranipet|isnapur|gurgaon|"
    r"gurugram|mohali|sonepat|sonipat|bahadurgarh|panchkula|coimbatore|dehradun|"
    r"gandhinagar|mysuru|mysore|jalandhar|haridwar|kochi|cochin|aurangabad|vijayawada|"
    r"visakhapatnam|vishakhapatnam)\b",
    re.I,
)


def city_from_title(title: str) -> str:
    last = ""
    for m in CITY_RE.finditer(title or ""):
        last = m.group(0)
    if last and re.search(r"north\s+delhi", title or "", re.I) and re.search(r"delhi", last, re.I):
        return "North Delhi"
    return last


def expand_state(body: str) -> str:
    body = body or ""
    reps = [
        (r"\bU\.P\.?", "Uttar Pradesh"),
        (r"\bM\.P\.?", "Madhya Pradesh"),
        (r"\bW\.B\.?", "West Bengal"),
        (r"\bA\.P\.?", "Andhra Pradesh"),
        (r"\bH\.P\.?", "Himachal Pradesh"),
        (r"\bTamilnadu\b", "Tamil Nadu"),
        (r"\bKarnatka\b", "Karnataka"),
        (r"\bUtter Pradesh\b", "Uttar Pradesh"),
        (r"\bUttrakhand\b", "Uttarakhand"),
        (r"\bHarayana\b", "Haryana"),
        (r"\bMaharshtra\b", "Maharashtra"),
        (r"\bState UP\b", "State Uttar Pradesh"),
        (r"\bState MP\b", "State Madhya Pradesh"),
        (r"\bState AP\b", "State Andhra Pradesh"),
        (r"\bState WB\b", "State West Bengal"),
    ]
    for pat, repl in reps:
        body = re.sub(pat, repl, body, flags=re.I if pat.endswith(r"\b") else 0)
    return body


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall((text or "").lower())


def compact_is(s: str) -> str:
    return IS_COMPACT.sub("", (s or "").upper())


def norm_name(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\b(and|for|of|with|the|in|to|a|an)\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    parts = s.split()
    if parts and parts[-1].endswith("s") and len(parts[-1]) > 4:
        parts[-1] = parts[-1][:-1]
    return " ".join(parts)


def title_key(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").lower()).strip()


def add(chunks: list[dict], kind: str, title: str, body: str, url: str) -> None:
    title = (title or "").strip()
    body = re.sub(r"\s+", " ", (body or "").strip())
    if not title and not body:
        return
    chunks.append(
        {
            "id": f"{kind}-{len(chunks)}",
            "kind": kind,
            "title": title[:240],
            "body": body[:1800],
            "url": url or KYS,
            "text": f"{title}. {body}"[:2000],
        }
    )


def already_titled(chunks: list[dict], title: str) -> bool:
    t = title_key(title)
    if not t:
        return True
    for c in chunks:
        e = title_key(c.get("title") or "")
        if not e:
            continue
        if e == t or (len(t) > 18 and (t[:36] in e or e[:36] in t)):
            return True
    return False


def load_knowledge() -> dict:
    if not KNOWLEDGE_PATH.exists():
        return {}
    return json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))


def load_labs_extra() -> dict[str, dict]:
    if not LABS_PATH.exists():
        return {}
    rows = json.loads(LABS_PATH.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    if isinstance(rows, list):
        for lab in rows:
            osl = str(lab.get("oslCode") or lab.get("id") or "").strip()
            if osl:
                out[osl] = lab
    return out


def enrich_standards(index: dict, kn: dict) -> None:
    """Attach official Know-Your-Standard detail URLs. Do not add extra catalogue rows."""
    kb_map: dict[str, dict] = {}
    for s in kn.get("standards") or []:
        key = compact_is(s.get("id") or "")
        if key and key not in kb_map:
            kb_map[key] = s
    if not kb_map:
        return
    for st in index.get("standards") or []:
        key = compact_is(st.get("id") or "")
        hit = kb_map.get(key)
        if not hit:
            continue
        url = (hit.get("official_url") or "").strip()
        if url and "bis.gov.in" in url:
            st["url"] = url
        amd = str(hit.get("amendments") or "").strip()
        if amd and amd not in {"0", "----", "-"} and "amendment" not in (st.get("kw") or "").lower():
            extra = f"amendments {amd}"
            st["kw"] = f"{st.get('kw') or ''} {extra}".strip()


def collapse_crs(chunks: list[dict]) -> list[dict]:
    """One CRS row per product. Keep live index IS; merge QCO date + listed IS from the dump."""
    other: list[dict] = []
    buckets: dict[str, dict] = {}
    order: list[str] = []
    for c in chunks:
        if c["kind"] != "crs":
            other.append(c)
            continue
        key = norm_name(c["title"]) or title_key(c["title"])
        if key in buckets:
            dest = buckets[key]
            extra: list[str] = []
            qm = re.search(r"QCO date ([^.]+)", c["body"], re.I)
            if qm and "QCO date" not in dest["body"]:
                extra.append(f"QCO date {qm.group(1).strip()}.")
            listed = re.findall(
                r"(?:Indian Standard|Standard)\s+([^.]{3,90})",
                c["body"],
                re.I,
            )
            have = dest["body"]
            for item in listed:
                item = item.strip().rstrip(".")
                if item and item not in have:
                    extra.append(f"Also listed as {item}.")
            if extra:
                dest["body"] = (dest["body"] + " " + " ".join(extra) + " Confirm live notified IS on " + CRS_URL + ".")[:1800]
                dest["text"] = f"{dest['title']}. {dest['body']}"[:2000]
            if "/products-bis.do" in (c.get("url") or "") and "/about-crs.do" in (dest.get("url") or ""):
                dest["url"] = c["url"]
        else:
            buckets[key] = c
            order.append(key)
    collapsed = [buckets[k] for k in order]
    return other + collapsed


def reid(chunks: list[dict]) -> list[dict]:
    for i, c in enumerate(chunks):
        c["id"] = f"{c['kind']}-{i}"
    return chunks


def build_chunks(index: dict, kn: dict, extra_labs: dict[str, dict]) -> list[dict]:
    chunks: list[dict] = []
    enrich_standards(index, kn)

    for st in index.get("standards") or []:
        extra = " ".join(filter(None, [st.get("kw") or "", st.get("group") or ""]))
        add(
            chunks,
            "standard",
            st.get("id") or "",
            f"{st.get('title') or ''}. Keywords: {extra}",
            st.get("url") or KYS,
        )
    for p in index.get("products") or []:
        add(
            chunks,
            "product",
            p.get("product_name") or "",
            " ".join(
                filter(
                    None,
                    [
                        p.get("standard_title"),
                        p.get("applicable_standard_id"),
                        p.get("certification_scheme"),
                        p.get("mandatory_or_voluntary"),
                        p.get("legal_basis_or_qco"),
                        p.get("required_mark_or_label"),
                        p.get("consumer_verification_method"),
                    ],
                )
            ),
            p.get("official_url") or p.get("source_url") or "",
        )
    for c in index.get("crs") or []:
        add(
            chunks,
            "crs",
            c.get("product") or "",
            f"CRS notified product. Standard {c.get('is_no')}. Category {c.get('category')}. Register at crsbis.in. Scheme-II Compulsory Registration.",
            CRS_URL,
        )
    for step in index.get("process") or []:
        add(
            chunks,
            "process",
            f"{step.get('scheme_name')}: {step.get('step_title') or step.get('service_name')}",
            " ".join(
                filter(
                    None,
                    [
                        step.get("step_description"),
                        step.get("fees_info") and f"Fee: {step['fees_info']}",
                        step.get("processing_time") and f"Time: {step['processing_time']}",
                    ],
                )
            ),
            step.get("official_url") or step.get("source_url") or "",
        )
    for h in index.get("hallmark") or []:
        add(
            chunks,
            "hallmark",
            " ".join(filter(None, [h.get("metal"), h.get("purity_grade"), h.get("carat"), h.get("fineness_code")])),
            " ".join(
                filter(
                    None,
                    [
                        h.get("hallmark_components"),
                        h.get("meaning_for_consumer"),
                        h.get("huid_or_identification_info"),
                        h.get("verification_method"),
                        h.get("consumer_precautions"),
                    ],
                )
            ),
            h.get("official_url") or "",
        )

    seen_osl: set[str] = set()
    for lab in index.get("labs") or []:
        osl = str(lab.get("id") or "").strip()
        seen_osl.add(osl)
        extra_l = extra_labs.get(osl) or {}
        until = extra_l.get("recognitionValidUpto") or extra_l.get("recognitionValidUptoRaw")
        status = extra_l.get("currentStatus")
        city = lab.get("city") or extra_l.get("city") or city_from_title(lab.get("name") or extra_l.get("name") or "")
        state = lab.get("state") or extra_l.get("state") or ""
        bits = [
            f"BIS Recognised Group-1 {lab.get('type') or extra_l.get('type') or ''}.",
            f"City {city}.",
            f"State {state}.",
            f"OSL {osl}.",
        ]
        if until:
            bits.append(f"Recognition listed until {until}.")
        if status:
            bits.append(f"Status {status}.")
        bits.append("Name/city snapshot only — confirm live scope on BIS LIMS. Do not claim this lab is accredited to test a named IS.")
        add(chunks, "lab", lab.get("name") or extra_l.get("name") or "", expand_state(" ".join(bits)), lab.get("url") or LIMS)

    for osl, lab in extra_labs.items():
        if osl in seen_osl:
            continue
        name = lab.get("name") or ""
        if not name:
            continue
        bits = [
            f"BIS Recognised Group-1 {lab.get('type') or 'Private'}.",
            f"City {lab.get('city') or city_from_title(name) or ''}.",
            f"State {lab.get('state') or ''}.",
            f"OSL {osl}.",
        ]
        if lab.get("recognitionValidUpto"):
            bits.append(f"Recognition listed until {lab['recognitionValidUpto']}.")
        if lab.get("currentStatus"):
            bits.append(f"Status {lab['currentStatus']}.")
        bits.append("Name/city snapshot only — confirm live scope on BIS LIMS. Do not claim this lab is accredited to test a named IS.")
        add(chunks, "lab", name, expand_state(" ".join(bits)), LIMS)

    for f in index.get("faqs") or []:
        add(chunks, "faq", f.get("question") or "", f.get("answer") or "", f.get("official_url") or f.get("source_url") or FAQ_URL)
    for c in index.get("consumer") or []:
        add(
            chunks,
            "consumer",
            c.get("topic") or "",
            " ".join(
                filter(
                    None,
                    [
                        c.get("user_action_steps"),
                        c.get("helpline") and f"Helpline {c['helpline']}",
                        c.get("email") and f"Email {c['email']}",
                    ],
                )
            ),
            c.get("official_url") or c.get("complaint_or_service_portal_url") or "",
        )
    for link in index.get("links") or []:
        add(
            chunks,
            "link",
            link.get("service_name") or "",
            f"{link.get('description') or ''} Portal: {link.get('portal_name') or ''}",
            link.get("official_url") or "",
        )

    if KB_PATH.exists():
        kb = json.loads(KB_PATH.read_text(encoding="utf-8"))
        faqs = kb.get("module_7_faqs") or []
        if isinstance(faqs, list):
            for f in faqs:
                title = f.get("question") or ""
                if already_titled(chunks, title):
                    continue
                add(chunks, "faq", title, f.get("answer_hinglish") or f.get("answer") or "", FAQ_URL)

    if kn:
        for row in kn.get("explore_bis") or []:
            title = row.get("title") or ""
            if already_titled(chunks, title):
                continue
            add(chunks, "faq", title, row.get("body") or "", row.get("official_url") or "https://www.bis.gov.in/the-bureau/?lang=en")
        for row in kn.get("crs_scheme") or []:
            title = row.get("title") or ""
            if already_titled(chunks, title):
                continue
            add(chunks, "process", title, row.get("body") or "", row.get("official_url") or CRS_URL)
        iso = kn.get("iso_iec_for_india") or {}
        for row in iso.get("intro") or []:
            title = row.get("title") or ""
            if already_titled(chunks, title):
                continue
            add(chunks, "faq", title, row.get("body") or "", row.get("official_url") or KYS)
        for row in kn.get("crs_products") or []:
            add(
                chunks,
                "crs",
                row.get("product") or "",
                f"CRS Scheme-II notified product. Indian Standard {row.get('is_number')}. QCO date {row.get('qco_date')}. Register at crsbis.in.",
                row.get("official_url") or CRS_URL,
            )

    chunks = collapse_crs(chunks)
    return reid(chunks)


def main() -> None:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    kn = load_knowledge()
    extra_labs = load_labs_extra()
    chunks = build_chunks(index, kn, extra_labs)
    rich = [c for c in chunks if c["kind"] != "standard"]
    catalogue = [{k: c[k] for k in ("id", "kind", "title", "body", "url")} for c in chunks if c["kind"] == "standard"]
    texts = [c["text"] for c in rich]
    vectorizer = TfidfVectorizer(
        tokenizer=tokenize,
        preprocessor=lambda s: s,
        token_pattern=None,
        ngram_range=(1, 2),
        min_df=1,
        sublinear_tf=True,
        norm="l2",
    )
    mat = normalize(vectorizer.fit_transform(texts))
    vocab = vectorizer.get_feature_names_out().tolist()
    sparse = []
    mat_csr = mat.tocsr()
    for i in range(mat_csr.shape[0]):
        row = mat_csr.getrow(i)
        sparse.append({"i": [int(x) for x in row.indices], "v": [round(float(x), 6) for x in row.data]})
    iso = "2026-09-12"
    pack = {
        "verified": iso,
        "verifiedAt": iso,
        "vocab": vocab,
        "idf": [round(float(x), 5) for x in vectorizer.idf_],
        "docs": sparse,
        "chunks": [{k: c[k] for k in ("id", "kind", "title", "body", "url")} for c in rich],
        "catalogue": catalogue,
    }
    OUT_PATH.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    kinds: dict[str, int] = {}
    for c in rich:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    print(
        json.dumps(
            {
                "rich": len(rich),
                "catalogue": len(catalogue),
                "vocab": len(vocab),
                "bytes": OUT_PATH.stat().st_size,
                "nnz": int(mat.nnz),
                "kinds": kinds,
            }
        )
    )


if __name__ == "__main__":
    main()
