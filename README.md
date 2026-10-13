# ManakMitra

**Evidence-grounded assistant for Indian Standards and BIS services.**

[![SIH](https://img.shields.io/badge/SIH_2026-SIH26107-0B1F3A)](https://www.sih.gov.in)
[![Team](https://img.shields.io/badge/Team-Prograckers-E87722)](#team)
[![Live](https://img.shields.io/badge/Live-Vercel-000)](https://forest-yonder-apex-plum.vercel.app/)
[![License](https://img.shields.io/badge/License-MIT-2ea44f)](LICENSE)

> Lock-first → retrieve-second → ground → **Allow / Clarify / Refuse**.  
> Public catalogue **metadata** only. No paid clause text. No invented fees.

**Smart India Hackathon 2026** · Problem statement **SIH26107**  
Ministry of Consumer Affairs, Food & Public Distribution · Theme: Smart Automation · Team ID **175176**

| Live MVP | Demo | Repo | Architecture |
| --- | --- | --- | --- |
| [Vercel](https://forest-yonder-apex-plum.vercel.app/) · [Grok preview](https://forest-yonder-apex-plum.grok.me) | [YouTube](https://www.youtube.com/watch?v=oi7lZYGw1Uw) | [github.com/owais265/ManakMitra](https://github.com/owais265/ManakMitra) | [gitdiagram](https://gitdiagram.com/owais265/manakmitra) |

This is **not** an official website of BIS or the Government of India. Always re-check the live portal before you apply, pay, or file.

**Contents:** [TL;DR](#tldr--what-a-judge-can-verify-today) · [Problem](#1-problem--who-pays-for-the-wrong-door) · [Innovation](#2-innovation--why-a-chatbot-was-not-enough) · [Why this design](#why-this-design-wins) · [Complexity](#3-technical-complexity--what-is-actually-hard) · [Feasibility](#4-feasibility--it-already-runs) · [Architecture](#5-architecture--system-design) · [Hybrid math](#hybrid-retrieval--the-actual-math) · [Anti-hallucination](#anti-hallucination--stronger-than-a-whitelist) · [Implementation](#6-implementation-quality) · [UX](#7-user-experience) · [Impact](#8-impact) · [Scale](#9-scalability--deployment) · [Start](#quick-start) · [Judge path](#judge-path--no-gpu-no-5-gb-download) · [Team](#team-prograckers)

---

## TL;DR — what a judge can verify today

A pure retrieval demo that always returns top-5 from one PDF is not this product. ManakMitra routes a user to the right BIS door, or refuses when the pack has no verified row.

| Check | What is true | How to see it |
| --- | --- | --- |
| Live multi-desk product | Home, chat, verify, labs, HUID, standards, certify, complaint, contact | [Open the site](https://forest-yonder-apex-plum.vercel.app/) |
| Three exits | Allow (sourced row) · Clarify (one missing fact) · Refuse (portal handoff, retrieval = 0) | Demo video + chat: IS 14543, unclear helmet, fan + HUID |
| Golden gates | M1–M10 pass without an LLM | `npm run eval:all` |
| Hybrid stress | 100 / 100 fail = 0 on the hybrid retrieve path (2026-10-13) | `scripts/hybrid-stress-100.mjs` |
| No invented IS / fee / clause | Faithfulness is a pass/fail gate, not a published 0.95 score | M3 and M10 |
| Official host only | A non-allowlisted URL is dropped | `src/lib/official-hosts.ts` |
| Pack-only kill switch | `HYBRID_RAG=0` still returns IS + scheme + official URL | Environment table below |
| No GPU required | Judge laptop runs the pack path in Docker or `npm run dev` | [Judge path](#judge-path--no-gpu-no-5-gb-download) |

What this README will **not** claim: Hit@3 on a 10-query cement set, a 0.45 s GPU latency, or a 559-standard building-materials corpus. Those numbers belong to a different hackathon and a different product. Ours is the SIH26107 assistant: standards **and** schemes **and** process **and** hallmarking **and** labs **and** consumer handoff, with a refuse when evidence is missing.

---

## How this maps to evaluation

Judges score understanding, novelty, depth, feasibility, design, a working build, UX, impact and scale. This README answers those questions with the live product — not a claim sheet.

| Criterion | What to inspect here | Live proof |
| --- | --- | --- |
| Problem understanding | [1](#1-problem--who-pays-for-the-wrong-door) | Wrong-door examples in the [demo video](https://www.youtube.com/watch?v=oi7lZYGw1Uw) |
| Innovation | [2](#2-innovation--why-a-chatbot-was-not-enough) | Fan + HUID **refuse** (retrieval = 0) |
| Technical complexity | [3](#3-technical-complexity--what-is-actually-hard) | Four locks before search; RRF only after unlock |
| Feasibility | [4](#4-feasibility--it-already-runs) | [Live MVP](https://forest-yonder-apex-plum.vercel.app/) |
| Architecture | [5](#5-architecture--system-design) | [RRF note](docs/rrf-and-gate.md) |
| Implementation | [6](#6-implementation-quality) | Desks + `npm run eval:all` |
| UX / UI | [7](#7-user-experience) | First-run path under 30 seconds |
| Impact | [8](#8-impact) | Official BIS scale, not invented MAU |
| Scalability | [9](#9-scalability--deployment) | Pack-only → hybrid extras → Vercel |

---

## 1. Problem — who pays for the wrong door

**Why does this problem exist?**  
BIS already publishes standards and runs certification, hallmarking, laboratory recognition, Standards Clubs, training and consumer affairs. The record is public. The path is not. A manufacturer, jeweller, student or consumer still has to guess which portal, which scheme and which document applies.

**Who faces it?**

| User | What they need | What goes wrong today |
| --- | --- | --- |
| MSME / startup | Applicable IS + scheme before they apply | Consultant fees, or days on the wrong form |
| Manufacturer / importer | ISI vs CRS vs FMCS vs QCO | One product family, several legal doors |
| Jeweller / consumer | Hallmark / HUID check | HUID language applied to fans, helmets, appliances |
| QC / lab user | Recognised lab + LIMS scope | Directory hunting; no PIN-to-lab path |
| Student / Standards Club | Plain-language IS identity | Catalogue and paid text mixed together |
| BIS / DoCA helpdesk | First-level routing | Repeat “which portal?” calls |

**How serious is it?**  
Official published scale of the BIS space (not ManakMitra usage):

| Published stock | Order of magnitude | Source class |
| --- | --- | --- |
| Indian Standards in force | ~23,300 | BIS public reporting cited on the idea PPT |
| Operative licences | ~51,500 | Same |
| New licences in a recent year | ~9,700 | Same |

Searching many portals and PDFs is exactly the pain SIH26107 names. The gap is not “there is no chatbot”. The gap is **routing with evidence**, so a user does not lose days at the wrong BIS door.

A product that only maps a building-material description to a 2005 summary PDF solves one slice of that pain. SIH26107 asks for the rest: certification schemes, process, consumer queries, hallmarking, testing laboratories, and multilingual interaction.

---

## 2. Innovation — why a chatbot was not enough

Generic RAG on mixed PDFs looks complete and still sends a fan query to jewellery verification. ManakMitra treats **refusal as a feature**.

What is unique (not a bundle of existing tools):

1. **Lock-first, retrieve-second.** Search is illegal until scope, scheme, source and evidence unlock.
2. **Scheme router.** ISI, CRS, FMCS, QCO and HUID stay separate. A mismatch does not retrieve.
3. **Three exits.** Allow (sourced row) · Clarify (one missing fact) · Refuse (portal handoff, retrieval = 0).
4. **Hybrid retrieve only after unlock.** Sparse TF-IDF on the pack, then optional Okapi BM25 + `pg_trgm` + pgvector, then RRF.
5. **Model-down continuity.** If the LLM is offline, the pack still returns IS number, scheme path and official URL.
6. **Public metadata only.** No paid clause text, no invented fees, no fake confidence score.

**Why this was not already solved:** BIS.gov.in is a library of portals, not a gate. A generic assistant can quote a paragraph and still pick the wrong scheme. The hard product is the gate.

---

## Why this design wins

Compared with a local BM25 + dense + cross-encoder stack over one PDF, these choices match the SIH26107 product, not a retrieval leaderboard.

| Decision | Why this, not the alternative |
| --- | --- |
| **Lock-first gate** | A fan + HUID query must not become a jewellery flow. Retrieval = 0 is the correct answer. |
| **Local TF-IDF as the rank lock** | Answers without a GPU, without a 5 GB model download, and without a vendor. Freeze at ≥ 0.45 so a near neighbour cannot replace an exact IS row. |
| **Official-host filter** | A row is usable only if its URL is on `bis.gov.in`, `manakonline.in`, `crsbis.in`, or an allowlisted host. A local whitelist of PDF titles is not the same guarantee. |
| **Refuse when the pack is silent** | Always returning top-5 invents confidence. Clarify or Refuse is the honest exit. |
| **Hybrid extras only when the lock is weak** | Dense, BM25, trigram, and rerank are skipped on a strong lock, a policy pin, and a typed IS already on top. |
| **RRF k = 60, rank only** | Sparse and dense stay on their own scales. Raw cosine is not added to raw BM25. |
| **Gated rerank** | Feature-rerank (or Cohere `rerank-v3.5` if a key is set) runs only when the local top is below 0.45. Frozen hits do not move. |
| **LLM phrases, never sources** | The model may phrase a pack row. It may not invent an IS number, a fee, or a clause. |
| **No paid IS text** | Full document text stays on Know Your Standard and e-Sale. The pack stores public metadata. |
| **Serverless, no GPU** | A judge opens the live site. A laptop runs the pack path with `npm run dev` or Docker. |

---

## 3. Technical complexity — what is actually hard

Complexity is used where the problem needs it.

| Hard part | Why it is not a wrapper |
| --- | --- |
| Policy gate before any index call | Off-topic, clause-ask, and scheme mix-up must die in milliseconds |
| Scheme-conflict detection | “Fan pe HUID” must not become a jewellery flow |
| Sparse + dense + RRF on one authorised pack | Rank fusion only on the unfrozen tail of allowlisted rows |
| Ground-then-generate | The model may phrase a pack row. It may not invent an IS number |
| Standalone turns | Chat history must not leak yesterday’s IS into today’s product |
| Language lock | Header language (EN / HI / Hinglish) beats query-script guessing |
| Eval harness M1–M10 | Gates are tested without an LLM |
| Lab-city word boundary | A contact-person first name must not match a city |

Not used: a billion-vector demo index, synthetic “official” PDFs, or a 22-language claim the pack cannot ground.

---

## 4. Feasibility — it already runs

The MVP is public. A judge can open it without installing anything.

| Proof | Where |
| --- | --- |
| Working app | https://forest-yonder-apex-plum.vercel.app/ |
| Demo walkthrough | https://www.youtube.com/watch?v=oi7lZYGw1Uw |
| Pack-only laptop path | `docker compose up --build` → http://localhost:8080 |
| Eval without an LLM | `npm run eval:all` |
| Hybrid retrieve stress | 100 questions, 0 fail (2026-10-13) |

Business path the product already supports:

| Actor | First action on ManakMitra | Official door it hands off to |
| --- | --- | --- |
| MSME with a product | Ask which IS and which scheme | Manakonline / CRS / Know Your Standard |
| Jeweller | Ask HUID format and verify path | huid.manakonline.in |
| Consumer with a fake mark | File a complaint | CARE / CMED |
| Lab user | Enter a PIN | LIMS directory |
| Student | Ask what an IS number is | Catalogue row + official URL |

Roadmap after the MVP (from the idea PPT, not vapour):

1. Scheme-conflict graph
2. Evidence freshness leases
3. Adversarial safety harness
4. Officer escalation packets
5. Gap scanner as a pathway constraint engine

Mature pieces: Postgres FTS + pgvector, serverless Node, optional LLM phrasing. The pack path does not depend on a model vendor.

---

## 5. Architecture and system design

Search is not allowed until the gate unlocks.

```mermaid
flowchart TD
  Q[User question<br/>EN · HI · Hinglish] --> U[Understand<br/>intent · product · IS · scheme · city]
  U --> G{Policy gate<br/>scope · scheme · source · evidence}
  G -->|fail| X[Refuse<br/>retrieval = 0<br/>official portal handoff]
  G -->|pass| S[Sparse retrieve<br/>TF-IDF on authorised pack]
  S --> W{Pack strong?}
  W -->|yes| E[Evidence pack]
  W -->|no| H[Hybrid extras<br/>Okapi BM25 + pg_trgm + pgvector]
  H --> F[RRF merge<br/>k = 60]
  F --> RR[Gated rerank<br/>only if top < 0.45]
  RR --> E
  E --> O{Outcome}
  O -->|clear row| A[Allow<br/>IS + title + official URL]
  O -->|one missing fact| C[Clarify<br/>one question]
  O -->|no row| X
  A --> R[Stream reply + next action]
  C --> R
  X --> R
```

The idea deck draws the hybrid core as PostgreSQL FTS + `pg_trgm` + pgvector HNSW + RRF. In this repo the **always-on sparse rank is local TF-IDF** over the JSON pack. Okapi BM25, `pg_trgm`, and pgvector are optional, and only after that pack is weak.

| Layer | Choice | Why this, not a larger stack |
| --- | --- | --- |
| App | React 19, TanStack Start, Vite, Tailwind | One TypeScript surface for UI + `/api/chat` |
| Gate + sparse RAG | [`src/lib/rag.ts`](src/lib/rag.ts), [`src/data/rag-pack.json`](src/data/rag-pack.json) | Answers without a vendor |
| Hybrid extras | Optional Okapi BM25 + `pg_trgm` + pgvector HNSW, fused by RRF (`k = 60`) | Never the rank lock. [`docs/rrf-and-gate.md`](docs/rrf-and-gate.md) |
| Phrasing LLM | Optional xAI, Gemini fallback | Phrases pack rows. Never the source of an IS number |
| Hosting | Vercel + Supabase | Live MVP for evaluation |

| Lock | Blocks |
| --- | --- |
| Scope | Sports, movies, trivia |
| Scheme | HUID on a fan, CRS language on jewellery |
| Source | Non-allowlisted hosts |
| Evidence | No pack row → no generated “fact” |

---

## Hybrid retrieval — the actual math

Formulas below are what the repository runs. Full write-up: [`docs/mathematical-framework.md`](docs/mathematical-framework.md).

### Policy gate

Four locks, each 0 or 1. Search is allowed only when the product is 1.

```text
Proceed(Q) = 1    iff    L_scope(Q) * L_scheme(Q) * L_source(Q) * L_evidence(Q) = 1
```

There is no soft cutoff. One failed lock stops the path.

### Local TF-IDF lock

Unigrams and bigrams. Sublinear TF. Smoothed IDF. L2-normalised cosine.

```text
tf(t, d)  = 1 + log(count(t, d))     when count > 0, else 0
idf(t)    = log( (1 + |D|) / (1 + df(t)) ) + 1
score     = cosine( normalise(q), normalise(d) )
```

A hit at score ≥ 0.45 is frozen. A typed IS number already on top is also a lock. Neither calls dense, BM25, trigram, or rerank.

### Okapi BM25 extras

Postgres has no BM25. `search_pack_docs_bm25` is Okapi, not `ts_rank`.

```text
idf(t) = ln( 1 + (N - df(t) + 0.5) / (df(t) + 0.5) )
tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
BM25(q, d) = sum over t in q of idf(t) * tf_norm(t, d)
k1 = 1.2
b = 0.75
```

An exact `is_number` hit gets a prior of 1000 inside the BM25 lane only. That prior is not added into the RRF sum. SQL: [`supabase/search_pack_docs_bm25.sql`](supabase/search_pack_docs_bm25.sql).

### Three-lane RRF

Used only after the gate, and only when the local pack row is weak. A missing lane adds 0.

```text
RRF(d) = 1/(60 + rank_dense(d)) + 1/(60 + rank_bm25(d)) + 1/(60 + rank_trgm(d))
```

RRF adds ranks. It does not add raw cosine to raw BM25. Extras are capped at three. An extra row’s displayed score is capped at 0.39 so it cannot sit above a frozen pack row.

### Gated rerank

Rerank runs only when extras exist and the local top is below 0.45, and never on a policy pin. Frozen pack rows are not in the rerank input. A non-official URL is dropped. With no rerank key the order is an explicit feature-rerank (exact IS, title token, BM25 lane, official host, family). That is a tie-break, not a neural score.

---

## Anti-hallucination — stronger than a whitelist

A whitelist extracted from one PDF guarantees the code exists in that PDF. It does not guarantee the code is the right door, the current title, or an official host.

ManakMitra stacks four independent refusals:

| Guard | What it stops |
| --- | --- |
| Official-host filter | Any URL not on `bis.gov.in`, `manakonline.in`, `crsbis.in`, or an allowlisted host |
| Evidence lock | No pack row → no generated fact. Exit is Refuse or Clarify |
| Faithfulness M3 / M10 | An IS number or clause that is not in the retrieved rows |
| Policy pin | Scheme mix-up, unknown IS, fake portal — extras are not called |
| Typed-IS freeze | A user-typed IS already on top cannot be replaced by a neighbour |

The system can still be wrong when the pack is stale. It cannot invent an IS that is not in the retrieved rows, and it will not answer a scheme mix-up with a retrieved neighbour.

---

## 6. Implementation quality

Built desks, not a slide-only assistant.

| Desk | User job |
| --- | --- |
| Assistant | Natural-language Q&A with three exits |
| Verify product | Licence-shaped check against the verify pack |
| Testing labs | PIN / city → nearest list + live LIMS |
| HUID / Hallmark finder | Jewellery path only |
| Indian Standards finder | Product / IS → catalogue row |
| Certification steps | Scheme process + official portal |
| File a complaint | CARE / CMED handoff |

Measured latency (prototype, idea PPT):

| Path | Measured / target | Notes |
| --- | --- | --- |
| Off-topic refuse | ~0.1–0.2 s | Gate only. Retrieval not called. [Trace](docs/rrf-and-gate.md) |
| In-scope pack answer | ~1.0–1.8 s | Gate + retrieve + pack |
| LLM phrasing | ~3–6 s | Only when a key works |
| Policy gate | < 50 ms | Four locks |
| Sparse / dense / RRF | < 200 / 300 / 100 ms | After unlock |

Out-of-scope path shape (band from the idea deck, not a fresh production stopwatch):

```text
query            "who won the cricket match yesterday"
lock.scope       FAIL
lock.scheme      skip
lock.source      skip
lock.evidence    skip
retrieval_calls  0
exit             REFUSE
time_band        0.1–0.2 s
```

Safety eval (`npm run eval:all`, no LLM required):

| Id | Gate |
| --- | --- |
| M1 | Product-family pin |
| M2 | Retrieval@3 of the pinned IS / CRS row |
| M3 | No invented IS; off-topic does not retrieve |
| M4 | Official URL present |
| M5 | Clarify-first on an underspecified product |
| M6 | Scheme mix-up blocked |
| M7 | Off-topic reject |
| M8 | Standalone query (no leaked IS) |
| M9 | Multilingual lock |
| M10 | Clause honesty |

---

## 7. User experience

A first-time user should not need a manual.

- One header language lock (English · Hindi · Hinglish) across every desk
- Suggested prompts on the landing page, same queries the assistant accepts
- Status the user can read: sourced answer, one clarifying question, or official handoff
- Official URL on an Allow — not a screenshot of a PDF
- Contact / complaint scrolls to the real handoff, it does not invent a ticket
- Light and dark theme; mobile, tablet and laptop

**Jury path (under two minutes):**

1. Pack hit — `Which Indian Standard applies to PET bottles for drinking water?`
2. Clarify — `Helmet ke liye BIS kaise milega?`
3. Safe refuse — `Fan pe HUID kaise check karun?`
4. Verify — a `CM/L` shape the verify desk accepts
5. Lab — PIN or city; map + LIMS
6. HUID — jewellery only

---

## 8. Impact

ManakMitra does not claim to serve every licence in India. It shortens the first-level path for people who already have to use BIS.

| Who | Measurable change if the gate holds |
| --- | --- |
| MSMEs and startups | Fewer wrong-scheme applications before Manakonline / CRS |
| Manufacturers and importers | ISI / CRS / FMCS named before they pay a consultant |
| Consumers and jewellers | HUID stays on jewellery; fake-mark complaint goes to CARE |
| QC and labs | Name / city / PIN → LIMS, not a guessed rating |
| Students and Clubs | IS identity in plain language, with the official record |
| BIS / DoCA helpdesks | Repeat “which portal?” questions drop to a handoff card |

Published BIS stock (~23.3K standards, ~51.5K operative licences) is the **addressable official space**, cited from BIS / PIB material on the idea PPT. It is not a user-count for this app.

---

## 9. Scalability and deployment

| Stage | What runs | What you add |
| --- | --- | --- |
| Judge laptop | Pack-only Docker / `npm run dev` | Nothing |
| Live MVP | Vercel + pack + optional LLM phrasing | `XAI_API_KEY` |
| Hybrid | Same app + Supabase `pack_docs` | `SUPABASE_*`, `HYBRID_RAG=1` |
| Production later | Same Postgres, freshness leases, conflict graph | Pack ops, not a rewrite |

Horizontal scale is boring on purpose: the gate is CPU-cheap, the pack is a snapshot, dense extras are an index on official rows. Cost stays low because refuse and pack-hit do not need a model. Idea-PPT operating sketch: a few thousand rupees a month at pilot query volume; model tokens only on Allow phrasing.

Kill switch: `HYBRID_RAG=0` → pack-only, still correct.

---

## What it does vs will not do

| Problem-statement job | What ManakMitra does | What it will not do |
| --- | --- | --- |
| Answer questions on Indian Standards | Match product / IS to catalogue title + official record | Invent an IS number or quote paid clause text |
| Recommend a standard from a product | Pack row + Know Your Standard link | Guess when the pack is silent |
| Guide certification schemes | Router: ISI · CRS · FMCS · QCO | Mix HUID into a fan / helmet query |
| Explain the process | Steps + portal when the FAQ pack has them | Invent fees or statutory timelines |
| Consumer queries | Complaints, fake mark, CARE / CMED | Act as a legal opinion |
| Hallmarking / HUID | Format + official verify path | Treat HUID as a product licence |
| Recognised laboratories | PIN / city + live LIMS | Book a test or invent a rating |
| Multilingual | EN · HI · Hinglish, header lock | Claim 22 languages it cannot ground |

---

## Quick start

```bash
git clone https://github.com/owais265/ManakMitra.git
cd ManakMitra
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Pack-only mode works with an empty `.env.local`.

```bash
npm run typecheck
npm test
npm run eval:all
```

---

## Judge path — no GPU, no 5 GB download

A judge does not need CUDA, a model cache, or a local FastAPI process.

| Step | Command or URL | What it proves |
| --- | --- | --- |
| 1. Open the product | https://forest-yonder-apex-plum.vercel.app/ | Multi-desk live app |
| 2. Walk the jury path | Prompts in [UX](#7-user-experience) | Allow, Clarify, Refuse, verify, lab, HUID |
| 3. Clone and eval | `npm install && npm run eval:all` | M1–M10 without an LLM |
| 4. Pack-only Docker | `docker compose up --build` | Same product offline from the pack |

Hybrid extras need `SUPABASE_*` and `HYBRID_RAG=1`. They are optional. The pack path is the rank lock either way.

---

## Docker

```bash
cp .env.example .env.local   # optional keys
docker compose up --build
```

App: [http://localhost:8080](http://localhost:8080)

| File | Role |
| --- | --- |
| [`Dockerfile`](Dockerfile) | Multi-stage Node 22 build + preview |
| [`docker-compose.yml`](docker-compose.yml) | Single service, port 8080 |
| [`.dockerignore`](.dockerignore) | Keeps the image small |

---

## Environment

Same names locally, in Docker, and on Vercel (Production + Preview). Redeploy after changing keys.

| Variable | Required | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | No | Chat phrasing. Tried first |
| `XAI_API_KEY_2` | No | Alternate xAI key |
| `XAI_MODEL` | No | Override model id |
| `GEMINI_API_KEY` | No | Phrasing fallback + ingest embeddings |
| `SUPABASE_URL` | No | Hybrid extras on `pack_docs` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server only. Never ship to the browser |
| `HYBRID_RAG` | No | `0` = pack-only kill switch |
| `RERANK_API_KEY` / `COHERE_API_KEY` | No | Optional Cohere `rerank-v3.5` on weak locks only |

---

## Pack operations

| Command | Effect |
| --- | --- |
| `npm run pack:rebuild` | Stamp verified date + validate |
| `npm run pack:add` | Ingest `data/inbox/` — official hosts only |
| `python scripts/build_rag_index.py` | TF-IDF rebuild from authorised CSVs |

Do **not** scrape BIS, merge unknown dumps, or store paid clause text. Full document text lives on [Know Your Standard](https://www.bis.gov.in/know-your-standard/?lang=en) and [e-Sale](https://standardsbis.bsbedge.com/).

```
src/routes/api/chat.ts          Chat handler
src/lib/rag.ts                  Policy + TF-IDF lock
src/lib/hybrid.ts               Optional extras + RRF merge
src/lib/rerank.server.ts        Gated rerank
supabase/search_pack_docs_hybrid.sql
supabase/search_pack_docs_bm25.sql
docs/rrf-and-gate.md            Fusion formula + gate trace
docs/mathematical-framework.md  Gate, RRF, TF-IDF, BM25, faithfulness
src/data/rag-pack.json          Authorised catalogue snapshot
scripts/eval-*.mjs              Golden + metrics
```

Operator rules: labs are a name/city list — confirm scope on [LIMS](https://lims.bis.gov.in/). Fees in the pack are FAQ figures. Each turn is standalone. QCO / mandatory status can change on the official site.

Official hosts: [bis.gov.in](https://www.bis.gov.in) · [manakonline.in](https://www.manakonline.in) · [crsbis.in](https://www.crsbis.in) · [lims.bis.gov.in](https://lims.bis.gov.in)

---

## Team Prograckers

| Name | Role |
| --- | --- |
| Navneet Kumar Singh | Leadership, resource allocation, presenter |
| Prapti Verma | PPT, UI/UX |
| Mohammed Owais | Data, backend, RAG architecture, servers |
| Rohit Kumar | Research, retrieval mathematics |
| Gurdev Singh | Research, GitHub, live deployment |
| Aman Dwivedi | Presenter, coordination, idea |

---

## License

[MIT](LICENSE) © 2026 Team Prograckers

See [CONTRIBUTING](CONTRIBUTING.md) and [SECURITY](SECURITY.md).
