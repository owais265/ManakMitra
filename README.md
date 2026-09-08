# ManakMitra — BIS Standards Assistant (SIH 26107)

Evidence-first assistant for Indian Standards, ISI / CRS / FMCS, hallmarking, labs, and consumer queries. If the authorised catalogue has no match, it **refuses** instead of inventing an IS number.

## How RAG works here

Industry RAG:

1. Split official text into **chunks**
2. Turn each chunk into a **vector** and store it
3. On a question, search nearest chunks
4. An LLM writes the answer **only from those chunks**

This repo does the same, as a **free MVP** (no Pinecone, no extra server):

| Step | This app |
|---|---|
| Vector store | [`src/data/rag-pack.json`](src/data/rag-pack.json) |
| Search | [`src/lib/rag.ts`](src/lib/rag.ts) inside the website |
| Chat API | [`src/routes/api/chat.ts`](src/routes/api/chat.ts) |
| LLM key | `XAI_API_KEY` (Grok) |

```
Question → /api/chat → search rag-pack.json → Grok answers from hits only
```

## Run locally

```bash
cp .env.example .env.local   # add XAI_API_KEY
npm install
npm run dev
```

## Deploy (Vercel, free)

1. Private GitHub repo. Never commit `.env`.
2. Import the repo on Vercel.
3. Settings → Environment Variables → `XAI_API_KEY`.
4. Deploy. Share the `*.vercel.app` URL.

No external backend or FastAPI host is required.

## Update data later

Editable sources live in [`data/`](data/). After edits:

```bash
pip install -r scripts/requirements-rag.txt
python scripts/build_rag_index.py
```

Commit the new `src/data/rag-pack.json` and redeploy. Details: [`data/README.md`](data/README.md).

## GitHub: commit vs never

**Commit:** app code, `src/data/*.json`, `data/*.csv`, this README.  
**Never:** `.env`, API keys, `artifacts/` (raw notes/PDFs), full IS PDF text.

## Jury checks

1. `IS 12229` — catalogue metadata.  
2. ISI application fee (Option-2) — official FAQ figures.  
3. BIS-recognised lab in Raipur — Group-1 names.  
4. `flying carpet for space tourism` — must refuse.
