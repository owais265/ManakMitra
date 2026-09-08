# Source data (edit here)

These CSVs + JSON packs are the human-editable BIS sources.

Live search is built into `src/data/rag-pack.json`.

## Update flow

1. Edit CSVs / `bis_chatbot_knowledge_base.json`, or refresh the big catalogue:

```bash
python scripts/collect_bis_catalogue.py
```

2. Rebuild the search index:

```bash
pip install -r scripts/requirements-rag.txt
python scripts/build_rag_index.py
```

3. Commit `src/data/rag-pack.json` (and `src/data/bis-index.json` if it changed).
4. Redeploy. No extra server.

Do **not** put full paid IS PDF text here.
