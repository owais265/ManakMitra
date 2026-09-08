#!/usr/bin/env python3
"""Build sparse TF-IDF vector pack for ManakMitra RAG. Run from repo root."""

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

TOKEN_RE = re.compile(r"[a-z0-9]+|[\u0900-\u097f]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall((text or "").lower())


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
            "url": url or "https://www.bis.gov.in",
            "text": f"{title}. {body}"[:2000],
        }
    )


def build_chunks(index: dict) -> list[dict]:
    chunks: list[dict] = []
    kys = "https://standards.bis.gov.in/website/know-your-standards"
    for st in index.get("standards") or []:
        extra = " ".join(filter(None, [st.get("kw") or "", st.get("group") or ""]))
        add(
            chunks,
            "standard",
            st.get("id") or "",
            f"{st.get('title') or ''}. Keywords: {extra}",
            st.get("url") or kys,
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
            "https://www.crsbis.in/BIS/about-crs.do",
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
    for lab in index.get("labs") or []:
        add(
            chunks,
            "lab",
            lab.get("name") or "",
            f"BIS Recognised Group-1 {lab.get('type')}. City {lab.get('city')}. State {lab.get('state')}. OSL {lab.get('id')}. Scope is in the official Group-1 PDF.",
            lab.get("url") or "",
        )
    for f in index.get("faqs") or []:
        add(chunks, "faq", f.get("question") or "", f.get("answer") or "", f.get("official_url") or f.get("source_url") or "")
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
                add(chunks, "faq", f.get("question") or "", f.get("answer_hinglish") or f.get("answer") or "", "https://www.bis.gov.in")

    if KNOWLEDGE_PATH.exists():
        kn = json.loads(KNOWLEDGE_PATH.read_text(encoding="utf-8"))
        for row in kn.get("explore_bis") or []:
            add(chunks, "faq", row.get("title") or "", row.get("body") or "", row.get("official_url") or "https://www.bis.gov.in")
        for row in kn.get("crs_scheme") or []:
            add(chunks, "process", row.get("title") or "", row.get("body") or "", row.get("official_url") or "https://www.crsbis.in/BIS/about-crs.do")
        iso = kn.get("iso_iec_for_india") or {}
        for row in iso.get("intro") or []:
            add(chunks, "faq", row.get("title") or "", row.get("body") or "", row.get("official_url") or "https://www.bis.gov.in")
        for row in kn.get("crs_products") or []:
            add(
                chunks,
                "crs",
                row.get("product") or "",
                f"CRS Scheme-II notified product. Indian Standard {row.get('is_number')}. QCO date {row.get('qco_date')}. Register at crsbis.in.",
                row.get("official_url") or "https://www.crsbis.in/BIS/products-bis.do",
            )
    return chunks


def main() -> None:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    chunks = build_chunks(index)
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
    pack = {
        "verified": index.get("verified", "2026-09-08"),
        "vocab": vocab,
        "idf": [round(float(x), 5) for x in vectorizer.idf_],
        "docs": sparse,
        "chunks": [{k: c[k] for k in ("id", "kind", "title", "body", "url")} for c in rich],
        "catalogue": catalogue,
    }
    OUT_PATH.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"rich={len(rich)} catalogue={len(catalogue)} vocab={len(vocab)} bytes={OUT_PATH.stat().st_size} nnz={int(mat.nnz)}")


if __name__ == "__main__":
    main()
