# Source data (edit here)

Human-editable BIS sources. Live search is [`src/data/rag-pack.json`](../src/data/rag-pack.json).

## Update flow

1. Edit the CSVs (and optionally `bis_chatbot_knowledge_base.json`).
2. Rebuild the search pack:

```bash
pip install -r scripts/requirements-rag.txt
python scripts/build_rag_index.py
```

3. Commit `src/data/rag-pack.json`. Redeploy. No extra server.

Do **not** store paid IS PDF / clause text here.
