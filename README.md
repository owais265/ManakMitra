# ManakMitra — BIS Standards Assistant (SIH 26107)

Evidence-first assistant for Indian Standards, ISI / CRS / FMCS, hallmarking, labs, and consumer queries. If the authorised catalogue has no match, it **refuses** instead of inventing an IS number.

Prototype by **team Prograckers**. Not an official BIS or Government of India website. MSME / consumer guide over catalogue **metadata** (IS number + title + official URL). Not SIH26108 (not a tender/procurement engine). Does **not** store paid clause text.

## Operator note

1. Metadata, not clauses. Full IS text: [Know Your Standard](https://standards.bis.gov.in/website/know-your-standards) and [e-Sale](https://standardsbis.bsbedge.com/).
2. Labs in the pack are a **name/city** list. Live test scope: [BIS LIMS](https://lims.bis.gov.in/home/search_is_number/).
3. Fees are **BIS FAQ figures** only — re-check the live FAQ before quoting a desk.
4. Each query is standalone. Cue-only words (`fees` / `lab` / `process`) do **not** reuse an earlier product. Name the product in the same message.
5. The pack is a **catalogue snapshot**, not a live BIS API. QCO/mandatory status can change.
6. Not a procurement/tender engine (SIH26108).
7. Stamp + validate pack date: `npm run pack:rebuild` then `npm run eval:all` (golden + rewrite + pack + **M1–M10 metrics**). Individual: `eval:golden`, `eval:rewrite`, `eval:pack`, `eval:metrics`. Does not scrape BIS. Does not merge unknown JSON dumps. Full TF-IDF rebuild from authorised CSVs + `data/manakmitra_bis_knowledge.json` (deduped CRS, no overlapping rows): `python scripts/build_rag_index.py`.
8. `XAI_API_KEY` is optional. Without it, grounded fallback still answers from the pack.
9. Optional full TF-IDF rebuild (sklearn): `python scripts/build_rag_index.py` — only after eval is green on a copy.
10. **Add a verified fact (easy):** drop `{id, kind, title, body, url}` JSON/CSV in [`data/inbox/`](data/inbox/) then `npm run pack:add`. Official host only. That updates `src/data/inbox-boost.json` and upserts `pack_docs`. Or append to [`src/data/verified-boost.json`](src/data/verified-boost.json) then `npm run pack:rebuild && npm run eval:all`. Do not ingest `manakmitra_bis_knowledge_10k.json` or paid clause text. No CMS UI.

## Jury metrics (M1–M10)

`npm run eval:metrics` (no LLM) prints pass-rate for:

| Id | What it gates |
|---|---|
| M1 | Product-family pin |
| M2 | Retrieval@3 of the pinned IS / CRS row |
| M3 | Hallucination-0 (no invented IS, offtopic does not retrieve) |
| M4 | Official URL 100% (pack + live hits + fallback) |
| M5 | Clarify-first on underspecified product |
| M6 | Scheme mix-up 0 (ISI vs CRS vs HUID) |
| M7 | Off-topic reject |
| M8 | Standalone query (no history fold / no leaked IS) |
| M9 | Multilingual lock (UI language pack) |
| M10 | Clause honesty (Know Your Standard / e-Sale, no invented clause text) |

Thresholds: 100% except M2 Retrieval@3 at 95%. Ingestion completeness (explore_bis, CRS link, empty-city labs) is in the same JSON under `ingestion`.

Official portals: [Know Your Standard](https://standards.bis.gov.in/website/know-your-standards) · [MANAK Online](https://www.manakonline.in) · [CRS](https://www.crsbis.in/BIS/about-crs.do) · [BIS](https://www.bis.gov.in) · [e-Sale](https://standardsbis.bsbedge.com/) · [LIMS](https://lims.bis.gov.in/home/search_is_number/)

## How retrieval works

Architecture: **Hybrid Sparse + Dense RAG with Metadata Filter and Policy Gate**.

| Step | This app |
|---|---|
| Authorised pack | [`src/data/rag-pack.json`](src/data/rag-pack.json) |
| Policy gate | [`src/lib/rag.ts`](src/lib/rag.ts) `policyEarlyHits` (runs **before** any vector search) |
| Sparse lock | local TF-IDF in [`src/lib/rag.ts`](src/lib/rag.ts) |
| Dense extras | `pack_docs` pgvector **768-d** when that kind has enough embeddings |
| Metadata extras | `search_pack_docs_hybrid` (RRF of trgm + dense) + family/scheme filter |
| Kill switch | `HYBRID_RAG=0` forces pack-only |
| Chat API | [`src/routes/api/chat.ts`](src/routes/api/chat.ts) |
| LLM key | `XAI_API_KEY` (optional) |

```
Question → policy pin? (always first, skips extras, no embed)
         → local sparse pack (rank lock)
         → extras only if pack is weak OR city-lab missing
         → search_pack_docs_hybrid (trgm + 768-d RRF, max 3 extras, score cap 0.39)
         → dense only if that kind is filled (labs ≥50, standards ≥400)
         → LLM answers from hits only (GROUNDING verified|refuse)
```

Do **not** rank from leftover `bis_pack_data` (`vector(256)` hash). That table is unused.

Dense ingest: apply [`supabase/pack_docs.sql`](supabase/pack_docs.sql) in the SQL editor, set server-only `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, then `npm run pack:ingest`. Without a Gemini key, rows ingest with `embedding` null; metadata/trgm extras still run. `HYBRID_RAG=0` is the pack-only kill switch.

## Run locally

```bash
cp .env.example .env.local   # add XAI_API_KEY
npm install
npm run dev
```

## Deploy (Vercel)

1. Private GitHub repo. Never commit `.env`.
2. Import the repo on Vercel.
3. Settings → Environment Variables → `XAI_API_KEY`. Optional later: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `HYBRID_RAG=0` (keep off until golden stays green).
4. Deploy. Share the `*.vercel.app` URL.

No external FastAPI host is required.

## GitHub: commit vs never

**Commit:** app code, `src/data/rag-pack.json`, `data/*.csv`, this README.  
**Never:** `.env`, API keys, scrape dumps, `artifacts/`, full IS PDF text, `.grok/`, `bis_knowledge_base_large.json`.
