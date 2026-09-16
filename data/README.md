# Source data

Human-editable BIS sources. Runtime search uses [`src/data/rag-pack.json`](../src/data/rag-pack.json).

## Add a verified row

1. Put JSON or CSV in [`inbox/`](inbox/).
2. `npm run pack:add`

JSON: `{ "id", "kind", "title", "body", "url" }` (array or `{ "chunks": [...] }`). Official hosts only.

## Full rebuild

1. Edit the numbered CSVs.
2. `python scripts/build_rag_index.py`
3. `npm run pack:rebuild && npm run eval:all`

Do not store paid IS PDF / clause text. Do not ingest synthetic Q&A dumps.
