# RRF fusion and the four-lock gate

This note matches the code in [`src/lib/hybrid.ts`](../src/lib/hybrid.ts) and [`supabase/search_pack_docs_hybrid.sql`](../supabase/search_pack_docs_hybrid.sql). It is not a second architecture.

## Two layers, on purpose

The idea deck names the hybrid core as PostgreSQL full-text search, `pg_trgm`, pgvector HNSW, and Reciprocal Rank Fusion. In this repository those Postgres pieces are **optional extras**.

| Layer | When it runs | What it is |
| --- | --- | --- |
| Rank lock | Every in-scope question | Local TF-IDF over [`src/data/rag-pack.json`](../src/data/rag-pack.json) |
| Hybrid extras | Only if `HYBRID_RAG` is not `0`, the pack row is weak, and the answer is not policy-pinned | `pg_trgm` plus pgvector HNSW, then RRF |

`HYBRID_RAG=0` never calls `pg_trgm` or pgvector. The pack still returns the IS number, scheme path, and official URL.

## How RRF combines the two lists

Sparse and dense are ranked separately, then fused. A missing lane adds nothing.

```text
score(d) = 1 / (k + rank_pgvector(d)) + 1 / (k + rank_pg_trgm(d))
k = 60
```

`rank` is 1 for the best hit in that lane. The SQL lives in `search_pack_docs_hybrid`: the vector list comes from `match_pack_docs` (pgvector), the lexical list from `search_pack_docs_trgm`. The same `k = 60` is used again in `mergeLocked` when the app merges those extras back onto the local pack.

RRF uses rank, not the raw cosine or trigram score. A very high vector similarity cannot swamp an exact IS-number hit just because the two score scales differ.

## What stops semantic drift

Dense search can surface a neighbour that is topically close and still the wrong standard. Four rules keep that neighbour from becoming the answer.

1. **Freeze.** A local TF-IDF hit with score ≥ 0.45 is not re-ranked. RRF only touches the unfrozen tail.
2. **Cap.** At most three extra rows are merged. An extra row’s displayed score is capped at 0.39, so it cannot sit above a frozen pack row.
3. **Lane size.** Dense search is skipped unless that lane is actually filled (at least 400 embedded standard rows, or 50 lab rows). A tiny vector index is not allowed to nearest-neighbour the answer.
4. **Policy pin.** A pinned answer (scheme mismatch, unknown IS, fake portal) never calls the embedder, `pg_trgm`, or RRF.

Official-host filtering still applies after the merge. A fused row with a non-allowlisted URL is dropped.

## Gate trace — out of scope

The four locks are scope, scheme, source, and evidence. An out-of-scope question fails the first lock. The other three are not evaluated. Retrieval is not called.

The block below is the path shape for that reject. The time band is the prototype band already published in the idea deck (about 0.1–0.2 s for the refuse path, gate work itself under 50 ms). It is not a freshly captured wall-clock sample from production.

```text
trace_id        gate-off-topic
query           "who won the cricket match yesterday"
lock.scope      FAIL     not a BIS question
lock.scheme     skip     not evaluated
lock.source     skip     not evaluated
lock.evidence   skip     not evaluated
retrieval_calls 0
tfidf           not called
pg_trgm         not called
pgvector_hnsw   not called
rrf             not called
exit            REFUSE
handoff         none — this is not a BIS door
time_band       0.1–0.2 s refuse path (idea-deck prototype band)
note            in-process gate only; no embed and no SQL on this path
```

A scheme mismatch such as “HUID on a fan” is different. Scope can pass, the scheme lock pins an official limit, and hybrid extras still do not run. That path is a sourced refuse, not an empty retrieval.
