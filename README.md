# ManakMitra — BIS Standards Assistant (SIH 26107)

Evidence-first assistant for Indian Standards, ISI / CRS / FMCS, hallmarking, labs, and consumer queries. If the authorised catalogue has no match, it **refuses** instead of inventing an IS number.

This is an **MSME / consumer** guide over catalogue **metadata** (IS number + title + official URL). It is **not** a procurement/tender engine (SIH26108) and it does **not** store paid clause text.

## Operator note

1. Pack rebuild: `pip install -r scripts/requirements-rag.txt && python scripts/build_rag_index.py` then commit `src/data/rag-pack.json`.
2. `XAI_API_KEY` is optional. Without it, answers fall back to catalogue metadata lists.
3. Catalogue rows are **not clauses**. Full IS PDFs are sold on the official e-Sale portal.
4. Fees in answers are **BIS FAQ figures** — re-check the live FAQ before quoting a ministry desk.
5. Labs are a **Group-1 name/city list**. Confirm product scope on [BIS LIMS](https://lims.bis.gov.in/home/search_is_number/).
6. Golden retrieval checks: `npm run eval:golden`.

## Jury spoken lines (memorize — not UI)

1. Catalogue metadata, not paid clause text — Know Your Standard / e-Sale.
2. Labs are a name/city list; confirm scope on BIS LIMS.
3. Fees are BIS FAQ figures — re-check the live FAQ.
4. This is MSME/consumer BIS guidance, not a procurement/tender engine (SIH26108).

Official portals: [Know Your Standard](https://standards.bis.gov.in/website/know-your-standards) · [MANAK Online](https://www.manakonline.in) · [CRS](https://www.crsbis.in/BIS/about-crs.do) · [BIS](https://www.bis.gov.in) · [e-Sale](https://standardsbis.bsbedge.com/)

## How retrieval works

| Step | This app |
|---|---|
| Authorised pack | [`src/data/rag-pack.json`](src/data/rag-pack.json) |
| Search | [`src/lib/rag.ts`](src/lib/rag.ts) sparse retrieve + product playbook |
| Chat API | [`src/routes/api/chat.ts`](src/routes/api/chat.ts) |
| LLM key | `XAI_API_KEY` (optional) |

```
Question → /api/chat → search rag-pack.json → LLM answers from hits only
```

## Run locally

```bash
cp .env.example .env.local   # add XAI_API_KEY
npm install
npm run dev
```

## Deploy (Vercel)

1. Private GitHub repo. Never commit `.env`.
2. Import the repo on Vercel.
3. Settings → Environment Variables → `XAI_API_KEY`.
4. Deploy. Share the `*.vercel.app` URL.

No external FastAPI host is required.

## Update data later

Editable sources live in [`data/`](data/). After edits run the pack rebuild command above.

## GitHub: commit vs never

**Commit:** app code, `src/data/*.json`, `data/*.csv`, this README.  
**Never:** `.env`, API keys, `artifacts/`, full IS PDF text, `.grok/`.

## Jury checks

1. Hindi cement → **IS 269** + Scheme-I process (metadata).
2. Helmet → disambiguate types; do not invent IS 4151 if absent.
3. Follow-up “ab process/fee” keeps the same product.
4. Raipur lab → names + “confirm LIMS scope”.
5. Clause question → refuse clause text; point to Know Your Standard / e-Sale.
6. `flying carpet` / IPL — must refuse.
