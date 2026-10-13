# RRF fusion and the four-lock gate

This note matches the code in [`src/lib/hybrid.ts`](../src/lib/hybrid.ts) and [`supabase/search_pack_docs_hybrid.sql`](../supabase/search_pack_docs_hybrid.sql). It is not a second architecture.

The four formulas (gate product, RRF, TF-IDF, faithfulness) are in [mathematical-framework.md](mathematical-framework.md).

## Two layers, on purpose

The idea deck names the hybrid core as PostgreSQL full-text search, `pg_trgm`, pgvector HNSW, and Reciprocal Rank Fusion. In this repository those Postgres pieces are **optional extras**.

| Layer | When it runs | What it is |
| --- | --- | --- |
| Rank lock | Every in-scope question | Local TF-IDF over [`src/data/rag-pack.json`](../src/data/rag-pack.json) |
| Hybrid extras | Only if `HYBRID_RAG` is not `0`, the pack row is weak, and the answer is not policy-pinned | Okapi BM25 + `pg_trgm` + pgvector HNSW, then three-lane RRF, then a gated rerank |

`HYBRID_RAG=0` never calls BM25, `pg_trgm`, pgvector, or the reranker. The pack still returns the IS number, scheme path, and official URL.

## How RRF combines the three lists

Dense, BM25, and trigram are ranked separately, then fused. A missing lane adds nothing.

```text
score(d) = 1/(k + rank_dense(d)) + 1/(k + rank_bm25(d)) + 1/(k + rank_trgm(d))
k = 60
```

`rank` is 1 for the best hit in that lane. The SQL lives in `search_pack_docs_hybrid`: the vector list comes from `match_pack_docs` (pgvector, only when a 768-d query embedding was passed), the BM25 list from `search_pack_docs_bm25`, the typo list from `search_pack_docs_trgm`. Each lexical lane is capped at 16 before fusion. The same `k = 60` is used again in `mergeLocked` when the app merges those extras back onto the local pack.

RRF uses rank, not the raw cosine, BM25, or trigram score. A very high vector similarity cannot swamp an exact IS-number hit just because the two score scales differ.

BM25 is Okapi with `k1 = 1.2` and `b = 0.75`. It is not `ts_rank`. An exact `is_number` prior of 1000 affects only the order inside the BM25 lane. It is not added into the RRF sum.

## Rerank

After fusion, and only when the local top score is below 0.45 and the row is not policy-pinned, extras (at most 20, frozen pack rows excluded) may be reordered. Take the top 5. `mergeLocked` still keeps at most 3 extras and caps their display score at 0.39. A frozen local hit never moves. A non-official URL never survives. With `RERANK_API_KEY` or `COHERE_API_KEY` this is Cohere `rerank-v3.5` (2.5 s timeout, then fall through). With no key it is `feature-rerank`, logged as such. It does not call Gemini.

## What stops semantic drift

Dense search can surface a neighbour that is topically close and still the wrong standard. Four rules keep that neighbour from becoming the answer.

1. **Freeze.** A local TF-IDF hit with score ≥ 0.45 is not re-ranked. RRF only touches the unfrozen tail.
2. **Cap.** At most three extra rows are merged. An extra row’s displayed score is capped at 0.39, so it cannot sit above a frozen pack row.
3. **Lane size.** Dense search is skipped unless that lane is actually filled (at least 400 embedded standard rows, or 50 lab rows). A tiny vector index is not allowed to nearest-neighbour the answer.
4. **Policy pin.** A pinned answer (scheme mismatch, unknown IS, fake portal) never calls the embedder, BM25, `pg_trgm`, or the reranker.
5. **Typed IS.** If the user typed an IS number and that number is already the top pack title, extras do not run. Dense and BM25 cannot replace it with a neighbour.

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
bm25            not called
pgvector_hnsw   not called
rerank          not called
rrf             not called
exit            REFUSE
handoff         none — this is not a BIS door
time_band       0.1–0.2 s refuse path (idea-deck prototype band)
note            in-process gate only; no embed and no SQL on this path
```

A scheme mismatch such as “HUID on a fan” is different. Scope can pass, the scheme lock pins an official limit, and hybrid extras still do not run. That path is a sourced refuse, not an empty retrieval.
