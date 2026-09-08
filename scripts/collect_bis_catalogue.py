#!/usr/bin/env python3
"""Collect official BIS public metadata into data/manakmitra_bis_knowledge.json."""

from __future__ import annotations

import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "manakmitra_bis_knowledge.json"
INDEX_PATH = ROOT / "src" / "data" / "bis-index.json"

UA = {"User-Agent": "Mozilla/5.0 (compatible; ManakMitraCollector/1.0)"}
ROW_RE = re.compile(
    r'isdetails_mnd/(\d+)"[^>]*>\s*(IS[^<]+?)\s*<.*?</td>\s*<td>(.*?)</td>\s*<td[^>]*>(.*?)</td>\s*<td[^>]*>(.*?)</td>',
    re.I | re.S,
)
GRP_RE = re.compile(r"Sub (?:Sub )?Group\s*:\s*([^)<]+)", re.I)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=22) as res:
        return res.read().decode("utf-8", "replace")


def clean(s: str) -> str:
    s = unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).replace("<b>/</b>", " / ").strip()


def parse_list(html: str, source: str, sid: int) -> list[dict]:
    m = GRP_RE.search(html)
    grp = clean(m.group(1)) if m else ""
    rows = []
    for mid, isn, title, amd, year in ROW_RE.findall(html):
        isn = clean(isn)
        title = clean(title)
        if not isn.startswith("IS") or len(title) < 3:
            continue
        rows.append(
            {
                "id": isn,
                "title": title,
                "group": grp,
                "amendments": clean(amd),
                "reaffirmation": clean(year),
                "portal_id": mid,
                "official_url": (
                    "https://www.services.bis.gov.in/php/BIS_2.0/bisconnect/"
                    f"knowyourstandards/Indian_standards/isdetails_mnd/{mid}"
                ),
                "source_list": source,
                "source_id": sid,
            }
        )
    return rows


def scrape_standards() -> list[dict]:
    jobs = []
    for i in range(1, 221):
        jobs.append(("sub_grp", i, f"https://www.services.bis.gov.in/php/BIS_2.0/dgdashboard/published/sub_grp_stn_list/{i}"))
    for i in range(1, 181):
        jobs.append(("sub_sub_grp", i, f"https://www.services.bis.gov.in/php/BIS_2.0/dgdashboard/published/sub_sub_grp_stn_list/{i}"))

    seen: dict[str, dict] = {}

    def one(job):
        source, i, url = job
        try:
            html = fetch(url)
            return parse_list(html, source, i)
        except Exception:
            time.sleep(0.4)
            try:
                return parse_list(fetch(url), source, i)
            except Exception:
                return []

    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(one, j) for j in jobs]
        for n, fut in enumerate(as_completed(futs), 1):
            for r in fut.result():
                k = r["id"].lower()
                if k not in seen:
                    seen[k] = r
            if n % 40 == 0:
                print(f"lists {n}/{len(jobs)} unique={len(seen)}", flush=True)
    return list(seen.values())


def scrape_crs() -> list[dict]:
    html = fetch("https://www.crsbis.in/BIS/products-bis.do")
    out = []
    for m in re.finditer(r"<tr>\s*<td>(\d+)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*<td>(.*?)</td>", html, re.S):
        out.append(
            {
                "kind": "crs_product",
                "sl": int(m.group(1)),
                "product": clean(m.group(2)),
                "is_number": clean(m.group(3)),
                "qco_date": clean(m.group(4)),
                "scheme": "Scheme-II CRS",
                "official_url": "https://www.crsbis.in/BIS/products-bis.do",
            }
        )
    return out


def explore_bis() -> list[dict]:
    return [
        {
            "id": "what-is-bis",
            "title": "What is BIS — Bureau of Indian Standards",
            "body": "BIS is the National Standards Body of India. It works on Indian Standards, marking and quality certification under the BIS Act, 2016 and the BIS (Conformity Assessment) Regulations, 2018. Services include Know Your Standard, Scheme-I ISI licences, Scheme-II CRS, FMCS, hallmarking, laboratory recognition, management-system certification, training, Standards Clubs and consumer complaints.",
            "official_url": "https://www.bis.gov.in/the-bureau/?lang=en",
        },
        {
            "id": "bis-act",
            "title": "BIS Act, Rules and Regulations",
            "body": "Public documents include BIS Act 2016, BIS Rules 2018, Conformity Assessment Regulations 2018 (and later amendments), and Hallmarking Regulations 2018. Always open the live Act/Rules page for the current PDF.",
            "official_url": "https://www.bis.gov.in/the-bureau/bis-act-rules-and-regulations/?lang=en",
        },
        {
            "id": "scheme-i",
            "title": "Scheme-I ISI Mark product certification",
            "body": "Licence-based product certification. Typical flow on Manakonline: find the Indian Standard, apply, inspection, testing in a BIS/recognised lab, grant of licence, use of ISI Standard Mark with CM/L licence number. Used for many QCO-notified products and voluntary licences.",
            "official_url": "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/scheme-i-mark-scheme/?lang=en",
        },
        {
            "id": "scheme-ii",
            "title": "Scheme-II Compulsory Registration Scheme CRS",
            "body": "Registration based on self-declaration of conformity plus a test report from a BIS-recognised lab. Typical CRS grant does not include factory inspection. Mark is the CRS Standard Mark with unique R-number. Portal: crsbis.in.",
            "official_url": "https://www.crsbis.in/BIS/about-crs.do",
        },
        {
            "id": "fmcs",
            "title": "FMCS Foreign Manufacturers Certification Scheme",
            "body": "Overseas factories placing regulated goods on the Indian market apply through FMCS, appoint an Authorized Indian Representative, and complete inspection/testing as prescribed before using the licensed Standard Mark.",
            "official_url": "https://www.bis.gov.in",
        },
        {
            "id": "kys",
            "title": "Know Your Standard portal",
            "body": "Official search by IS number or product keyword. Shows metadata, amendments, linked licences and labs. Full standard PDF follows the official download/login path. Catalogue rows in this assistant are metadata (id + title), not full clause text.",
            "official_url": "https://standards.bis.gov.in/website/know-your-standards",
        },
        {
            "id": "care-app",
            "title": "BIS Care App consumer verification",
            "body": "Consumers can verify ISI licence numbers, CRS registrations and jewellery HUID through official BIS digital services / BIS Care App rather than trusting a shop claim alone.",
            "official_url": "https://www.bis.gov.in",
        },
    ]


def crs_scheme() -> list[dict]:
    return [
        {
            "id": "crs-legal",
            "title": "CRS legal basis Scheme-II",
            "body": "CRS grant and operation follow Scheme-II of Schedule-II of the BIS (Conformity Assessment) Regulations, 2018. Electronics/IT coverage started with the Electronics and Information Technology Goods (Requirement for Compulsory Registration) Order, 2012 (MeitY, 03 Oct 2012). Later additions cover more electronics, MNRE solar PV goods (2017), some chemicals, and cotton bales. Ministries: MeitY, MNRE, Chemicals and Fertilizers, Textiles.",
            "official_url": "https://www.crsbis.in/BIS/about-crs.do",
        },
        {
            "id": "crs-who",
            "title": "Who must comply with CRS",
            "body": "The manufacturer (factory owner) of a product under a Compulsory Registration Order. The Orders say no person shall manufacture or store for sale, import, sell or distribute such goods unless they conform to the specified Indian Standard and bear the Standard Mark with a unique BIS registration number (R-number).",
            "official_url": "https://www.crsbis.in/BIS/about-crs.do",
        },
        {
            "id": "crs-steps",
            "title": "Official CRS registration steps",
            "body": "1 Generate Test Request on crsbis.in and select a BIS-recognised lab. 2 Send sample plus Test Request to the lab within 60 days of generating the Test Request. 3 Get the product tested against the notified Indian Standard. 4 Verify the lab test report. 5 Apply on the portal using that verified test report within 90 days of its issue. 6 Upload checklist documents (business licence in English or certified translation, brand papers, Form-I; foreign applicants add AIR nomination). 7 On grant, mark each product/pack with the CRS Standard Mark and unique R-number.",
            "official_url": "https://www.crsbis.in/BIS/registration-page.do",
        },
        {
            "id": "crs-mark",
            "title": "CRS Standard Mark versus ISI mark",
            "body": "CRS goods carry the Scheme-II Standard Mark plus unique R-number. Scheme-I ISI uses the ISI mark plus CM/L licence number on Manakonline. Do not mix the two marks. A product is under one notified route unless official text says otherwise. ISO 9001 factory certificates are not a substitute for CRS or ISI where a QCO applies.",
            "official_url": "https://www.crsbis.in/BIS/about-crs.do",
        },
        {
            "id": "crs-list",
            "title": "Where to read the live CRS product list",
            "body": "The notified product + Indian Standard + QCO date table is on the official CRS products page. Always re-check the live page before telling a user a product is or is not notified.",
            "official_url": "https://www.crsbis.in/BIS/products-bis.do",
        },
    ]


def iso_intro() -> list[dict]:
    return [
        {
            "id": "how-india-adopts-iso",
            "title": "How ISO and IEC standards become Indian Standards",
            "body": "BIS may adopt an international standard as an Indian Standard. Identical adoptions are commonly shown with dual numbering (IS number and ISO/IEC number) or as IS/ISO or IS/IEC. Modified adoptions are marked MOD / technically equivalent on committee lists. Confirm degree of equivalence on Know Your Standard.",
            "official_url": "https://standards.bis.gov.in/website/know-your-standards",
        },
        {
            "id": "common-ms-iso",
            "title": "Common IS/ISO management system standards used in India",
            "body": "Widely used adoptions include IS/ISO 9001 quality management, IS/ISO 14001 environmental management, IS/ISO 45001 occupational health and safety, IS/ISO 22000 food safety, IS/ISO 50001 energy management, IS/ISO 13485 medical devices QMS, IS/ISO 39001 road traffic safety, IS/ISO 21101 adventure tourism safety, IS 15700 service quality (SQMS), IS 15000 HACCP. These are Indian Standard designations of the international documents as adopted by BIS.",
            "official_url": "https://www.bis.gov.in",
        },
        {
            "id": "iso-not-isi",
            "title": "An ISO certificate is not an ISI or CRS licence",
            "body": "An ISO 9001 certificate from a certification body is not the same as a BIS Scheme-I licence or Scheme-II CRS registration. QCO-notified products still need the notified BIS route even if the factory already holds ISO management-system certification.",
            "official_url": "https://www.bis.gov.in",
        },
    ]


def merge_into_index(standards: list[dict], crs: list[dict]) -> None:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    existing = {str(s.get("id") or "").lower(): s for s in index.get("standards") or []}
    kys = "https://standards.bis.gov.in/website/know-your-standards"
    added = 0
    for st in standards:
        key = st["id"].lower()
        if key in existing:
            # keep richer local keywords if present
            continue
        words = re.findall(r"[a-z0-9]+", (st["title"] + " " + st.get("group", "")).lower())
        uniq = list(dict.fromkeys(w for w in words if len(w) > 2))[:12]
        kw = ";".join(uniq)
        existing[key] = {
            "id": st["id"],
            "title": st["title"],
            "kw": kw,
            "url": st.get("official_url") or kys,
            "group": st.get("group") or "",
        }
        added += 1
    index["standards"] = list(existing.values())

    if crs:
        by_prod = {str(c.get("product") or "").lower(): c for c in (index.get("crs") or [])}
        for c in crs:
            k = c["product"].lower()
            if k in by_prod:
                continue
            by_prod[k] = {
                "sl": c.get("sl"),
                "is_no": c.get("is_number"),
                "product": c.get("product"),
                "category": "CRS notified",
            }
        index["crs"] = list(by_prod.values())

    index["verified"] = "2026-09-08"
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"index standards={len(index['standards'])} added={added} crs={len(index.get('crs') or [])}")


def main() -> None:
    print("scraping published standards…", flush=True)
    standards = scrape_standards()
    print("standards", len(standards), flush=True)
    try:
        crs = scrape_crs()
    except Exception as e:
        print("crs fail", e)
        crs = []
    print("crs", len(crs), flush=True)

    iso_hits = []
    seen = set()
    for st in standards:
        blob = f"{st['id']} {st['title']}"
        if not re.search(r"ISO|IEC", blob, re.I):
            continue
        k = st["id"].lower()
        if k in seen:
            continue
        seen.add(k)
        fam = "ISO/IEC" if re.search(r"IEC", blob, re.I) and re.search(r"ISO", blob, re.I) else (
            "IEC" if re.search(r"IEC", blob, re.I) else "ISO"
        )
        iso_hits.append(
            {
                "indian_standard": st["id"],
                "title": st["title"],
                "adopted_family": fam,
                "group": st.get("group") or "",
                "official_url": st.get("official_url"),
            }
        )

    pack = {
        "meta": {
            "title": "ManakMitra BIS authorised public metadata pack",
            "problem_code": "SIH26107",
            "collected_at": "2026-09-08",
            "verified_note": "Metadata only. Full IS/ISO PDF clauses are not stored.",
            "counts": {
                "standards": len(standards),
                "crs_products": len(crs),
                "explore_bis": 7,
                "crs_scheme": 5,
                "iso_iec_intro": 3,
                "iso_iec_catalogue_hits": len(iso_hits),
            },
        },
        "standards": standards,
        "crs_products": crs,
        "explore_bis": explore_bis(),
        "crs_scheme": crs_scheme(),
        "iso_iec_for_india": {"intro": iso_intro(), "adopted_from_catalogue": iso_hits},
    }
    pack["meta"]["counts"]["total_records"] = (
        len(standards) + len(crs) + 7 + 5 + 3 + len(iso_hits)
    )
    OUT.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    merge_into_index(standards, crs)


if __name__ == "__main__":
    main()
