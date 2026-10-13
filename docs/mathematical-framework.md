# Mathematical framework

Four pieces the idea deck names: the policy gate, Reciprocal Rank Fusion, TF-IDF, and faithfulness. Each formula below is the one the repository actually runs, or it is marked as a design rule the harness enforces as pass/fail.

## 1. Policy gate

Four locks, in order: scope, scheme, source, evidence. A lock is 0 or 1. Search is allowed only when every lock is 1.

```text
Proceed(Q) = 1    iff    L_scope(Q) * L_scheme(Q) * L_source(Q) * L_evidence(Q) = 1
```

The deck writes the same product with `P(Lock i Valid | Q)` and a threshold `theta`. In this repository each term is an indicator, and the threshold is exactly 1. There is no calibrated probability and no soft cutoff. One failed lock is enough to stop.

| Lock | What a 0 means |
| --- | --- |
| Scope | Not a BIS question. Retrieval is not called. |
| Scheme | The named scheme does not belong to that product. Hybrid extras are not called. |
| Source | The URL is not on the official-host list. The row is dropped. |
| Evidence | The pack has no row. The model may not invent an IS number, a fee, or a clause. |

An out-of-scope question fails scope and does not evaluate the other three. The refuse path is the 0.1–0.2 s prototype band in [rrf-and-gate.md](rrf-and-gate.md). That band is from the idea deck, not a fresh stopwatch sample.

## 2. Reciprocal Rank Fusion

Used only after the gate, and only when the local pack row is weak. `k = 60`. Three lanes. A lane that did not return `d` contributes 0.

```text
RRF(d) = 1/(60 + rank_dense(d)) + 1/(60 + rank_bm25(d)) + 1/(60 + rank_trgm(d))
```

Rank 1 is the best hit in that lane. RRF adds ranks. It does not add raw cosine to raw BM25 or raw trigram similarity.

Dense runs only when the query embedding is present and that lane is filled (at least 400 embedded standard rows, 50 lab rows, otherwise 400 rows in total). BM25 and trigram are both lexical. Each lane is capped at 16 before fusion. The SQL result is capped by `extra_cap` (default 3, hard cap 20). The app still merges at most 3 extras.

A local TF-IDF hit with score ≥ 0.45 is frozen and is not re-ranked. A typed IS number that is already the top pack hit is also a lock: dense, BM25, trigram, and rerank are not called. An extra row’s displayed score is capped at 0.39. SQL: [supabase/search_pack_docs_hybrid.sql](../supabase/search_pack_docs_hybrid.sql) and [supabase/search_pack_docs_bm25.sql](../supabase/search_pack_docs_bm25.sql). App merge: [src/lib/hybrid.ts](../src/lib/hybrid.ts).

### BM25 lane

Postgres has no BM25. `search_pack_docs_bm25` is Okapi, not `ts_rank` and not `pg_trgm`.

```text
idf(t) = ln( 1 + (N - df(t) + 0.5) / (df(t) + 0.5) )
tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
BM25(q, d) = sum over t in q of idf(t) * tf_norm(t, d)
k1 = 1.2
b = 0.75
```

`tf` is the `simple` tsvector position count. `df` comes from `ts_stat` on that same vector. A term missing from `pack_term_df` adds 0. Candidate generation is the GIN index on the rarest query term (limit 400) plus the `is_number` btree. An exact `is_number` hit gets a prior of 1000 so it outranks a fuzzy title inside this lane. That prior is not part of the BM25 sum. RRF still uses rank only.

### Rerank

Rerank runs only after extras exist, only when the local top score is below 0.45, and never on a policy pin. Frozen pack rows are not in the rerank input, so they cannot move. A non-official URL is dropped. If `RERANK_API_KEY` or `COHERE_API_KEY` is set, the call is Cohere `rerank-v3.5` with a 2.5 s timeout. If it is not set, the order is an explicit `feature-rerank` (exact IS number, title token, BM25 lane, official host, family). That is a tie-break, not a neural score, and it does not call Gemini.

## 3. TF-IDF sparse rank

The always-on rank is local TF-IDF over the JSON pack, built by scikit-learn in [scripts/build_rag_index.py](../scripts/build_rag_index.py). It is not PostgreSQL full-text search. `pg_trgm` is the optional lexical extra.

Unigrams and bigrams. `sublinear_tf` is on. Smoothed IDF. Each document row is L2-normalised, so the query dot product is cosine.

```text
tf(t, d)  = 1 + log(count(t, d))     when count > 0, else 0
idf(t)    = log( (1 + |D|) / (1 + df(t)) ) + 1
weight    = tf(t, d) * idf(t)
score     = cosine( normalise(q), normalise(d) )
```

The deck’s shorter form, `tf * log(|D| / (1 + df))`, is the same idea. The running weights are the smoothed scikit-learn form above. Rare tokens such as an IS number outweigh generic words such as “standard” or “mark”.

## 4. Faithfulness

A generated claim that names an IS number, a fee, a lab, or a clause is allowed only when that string is in the retrieved pack rows.

```text
Faithfulness(Q, C, A) = |{ claims in A entailed by pack C }| / |claims in A|
```

This is the rule the answer prompt and the eval harness enforce. It is not a RAGAS library run, and this repository does not publish a score of 0.95. The checks are pass/fail:

| Check | What it refuses |
| --- | --- |
| M3 | An IS number that is not in the hits, and any retrieval on an off-topic question |
| M10 | A clause number that is not written in the pack row |

`npm run eval:all` runs these without an LLM.
