# Source data (edit here)

Human-editable BIS sources. Live search is [`src/data/rag-pack.json`](../src/data/rag-pack.json).

## Easy add (preferred)

1. Put a JSON/CSV file in [`inbox/`](inbox/).
2. Run `npm run pack:add`
3. Chat uses `src/data/inbox-boost.json` immediately. Supabase `pack_docs` upserts new hashes only.

JSON shape: `{ "id", "kind", "title", "body", "url" }` (array or `{ "chunks": [...] }`). Official hosts only.

## Full rebuild

1. Edit the CSVs (and optionally `bis_chatbot_knowledge_base.json`).
2. `python scripts/build_rag_index.py`
3. `npm run pack:add`

Do **not** store paid IS PDF / clause text here.
Do **not** ingest `bis_knowledge_base_large.json` (synthetic 50k Q&A).
