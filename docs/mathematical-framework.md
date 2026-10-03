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

Used only after the gate, and only when the local pack row is weak. `k = 60`.

```text
RRF(d) = 1/(60 + rank_pgvector(d)) + 1/(60 + rank_pg_trgm(d))
```

A lane that did not return `d` contributes 0. Rank 1 is the best hit in that lane. RRF adds ranks. It does not add raw cosine to raw trigram similarity, so the two scales cannot swamp each other.

A local TF-IDF hit with score ≥ 0.45 is frozen and is not re-ranked. At most three extra rows are merged, and an extra row’s displayed score is capped at 0.39. SQL: [supabase/search_pack_docs_hybrid.sql](../supabase/search_pack_docs_hybrid.sql). App merge: [src/lib/hybrid.ts](../src/lib/hybrid.ts).

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
