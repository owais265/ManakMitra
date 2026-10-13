# grok.md — ManakMitra agent memory (Antigravity / any agentic builder)

**Read this file fully before writing code, changing architecture, or claiming metrics.**  
This is the continuation contract. Resume from **LAST STATE** at the bottom. Do not restart the product from a generic chatbot template.

---

## 0. Identity (do not rewrite)

| Field | Value |
| --- | --- |
| Product | **ManakMitra** |
| Problem | **SIH26107** — AI-powered Intelligent Assistant for Indian Standards and BIS Services |
| Theme | Smart Automation · Software |
| Team | **Prograckers** |
| Owner | Mohammed Owais (`github.com/owais265`) |
| Hackathon | Smart India Hackathon 2026 (idea window historically ~20 Sep 2026) |
| One-line | Evidence-grounded BIS **navigation** assistant — not a guessing chatbot, not a BIS officer, not a licence issuer |
| Golden rule | **A confident unsupported answer is worse than an honest refusal.** |

**Not an official BIS / Government of India website.**

---

## 1. What we are building (locked)

ManakMitra helps MSMEs, manufacturers, importers, consumers, students, QA teams, and lab users:

- Find relevant **Indian Standard metadata** (IS number + title + official URL)
- Distinguish **ISI vs CRS vs hallmarking/HUID vs labs**
- Reach **authorised portals** (not invented process)
- Interact in **English / Hindi / Hinglish** with **UI language lock** (reply language = header, not query)

### Explicit non-goals (never implement these as product claims)

- Paid full-standard clause library / PDF dump of IS text
- Licence / certificate issuance
- Legal determination or accreditation verdicts
- Invented fees, QCO status, or clause numbers
- Tender / procurement engine (**that is SIH 26108**, out of scope)
- Open-web RAG
- “Answer every question” chatbot
- Claiming 95%+ accuracy without a scored run
- Replacing BIS officers

**Prototype scope (MVP):** landing + chat + policy gate + hybrid retrieve + SOURCE chips + one-question clarify + safe refuse + pack-only fallback if LLM down. Full 20,000-standard catalogue is **later, controlled expansion**.

---

## 2. Architecture (do not replace)

**Lock-first hybrid RAG.** Policy runs **before** any retrieval. LLM **phrases** evidence; it does not invent facts.

### Pipeline

```
ASK (EN / HI / Hinglish)
  → UNDERSTAND (normalize, entities, missing attrs)
  → POLICY GATE (scope → scheme → source → evidence)
       FAIL → REFUSE + official portal  (zero retrieval, zero LLM if possible)
       PASS
  → SPARSE retrieve (local TF-IDF pack + pg_trgm)
  → if pack weak: DENSE extras (pgvector HNSW 768-d)
  → RRF fusion, extras capped
  → GROUND (pack rows + allowlisted hosts only)
  → EXIT:
       ALLOW  = sourced answer (IS + title + URL)
       CLARIFY = exactly ONE high-value question
       REFUSE  = safe handoff to official portal
```

### RAG types in this product (all of these; not “generic RAG”)

| Type | Implementation | Purpose |
| --- | --- | --- |
| Sparse | TF-IDF on `src/data/rag-pack.json` + `pg_trgm` | Exact IS / tokens |
| Dense | `pgvector` HNSW (optional, 768-d Gemini embeddings at **ingest only**) | Natural language |
| Hybrid | Reciprocal Rank Fusion | Merge lists |
| Grounded | Evidence block only | No invented fees/clauses |
| Gated | Policy before search | Mix-scheme / off-topic blocked |

Kill switch: `HYBRID_RAG=0` → pack-only.

### Three exits only

Allow (with source) · Clarify (one question) · Refuse (portal handoff)

### Gap Scanner (product preview, not a certificate)

Shows covered vs missing steps on a product’s BIS path. **Not** a fee quote, licence, or legal decision. If implementing, keep it as a **constraint preview**, not an approval engine.

---

## 3. Stack (as built — do not swap casually)

| Layer | Tech |
| --- | --- |
| App | React 19, TypeScript, TanStack Start/Router, Vite, Tailwind v4 |
| Chat API | `src/routes/api/chat.ts` — POST `{ query, language }` |
| Policy | `src/lib/policy-gate.ts`, `src/lib/intent.ts`, `src/lib/rag.ts` |
| Retrieve | `src/lib/retrieve.ts`, `src/lib/hybrid.ts` |
| Pack | `src/data/rag-pack.json` + CSVs in `data/` |
| DB | Optional Supabase Postgres: `pg_trgm` + `pgvector`; SQL in `supabase/` |
| LLM | **Optional** xAI (`XAI_API_KEY` / `XAI_API_KEY_2`) — **phrasing only** |
| Embeddings | Optional `GEMINI_API_KEY` — ingest only, **never chat** |
| Host | Vercel (Nitro preset) |

Auth in this product is **OFF for users**. Do not add login/signup for the SIH demo unless explicitly asked. Grok sandbox still has unused auth scaffolding (`src/lib/auth/*`) — **do not wire it into the public product**.

### Official hosts (allowlist)

`bis.gov.in`, `manakonline.in`, `huid.manakonline.in`, `crsbis.in`, `lims.bis.gov.in`, `standardsbis.bsbedge.com`, `india.gov.in` (and related BIS public pages).  
Never scrape paid PDFs. Never store clause text.

---

## 4. Repos, URLs, connectors

| Resource | Value | Notes |
| --- | --- | --- |
| GitHub (canonical) | https://github.com/owais265/ManakMitra | Was **private**; make **public** for jury |
| Old/wrong names | `owais265/forest-yonder-apex-plum`, `owais265/manakmitra-`, `sunny-trail-monarch-lilac` | Do not point PPT/gitdiagram at these |
| Vercel demo | https://forest-yonder-apex-plum.vercel.app | Primary public MVP |
| Grok preview | `*.grok.me` | Do **not** put grok.me on SIH PPT as primary (looks generated) |
| Demo video | https://youtu.be/TMvUKSPN6nU | |
| Git diagram (stale) | gitdiagram.com still pointed at forest-yonder-apex-plum | Update to ManakMitra |
| Eval Drive | Google Drive folder used as “RAG Test Set (Retrieval + Gate)” | Team artefacts, not BIS official docs |

### Chat API contract (measured)

```http
POST /api/chat
Content-Type: application/json

{ "query": "ISI mark for cement", "language": "en" }
```

Wrong bodies (`message`, `messages`, `question`) return **400** “Please enter your question.”

---

## 5. Environment (critical)

Same names locally **and** Vercel **Production + Preview**. After any key change: **Redeploy**.

| Variable | Role |
| --- | --- |
| `XAI_API_KEY` | Chat phrasing |
| `XAI_API_KEY_2` | Preferred if both set |
| `XAI_MODEL` | Optional model id — do not hardcode `grok-4.5` in README |
| `SUPABASE_URL` | Hybrid extras |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Never `VITE_` / `NEXT_PUBLIC_` |
| `HYBRID_RAG` | `0` = pack-only |
| `GEMINI_API_KEY` | Embeddings ingest only |

Pack fallback **must** still answer or refuse if LLM is down. If in-scope questions 502, keys are missing/invalid — **fix env, do not rewrite RAG**.

---

## 6. LAST MEASURED LIVE STATE (2026-09-19)

Do **not** invent better numbers.

| Probe | Result |
| --- | --- |
| `GET /` | HTTP 200 — site up |
| In-scope queries (cement ISI, HUID, CRS, labs, Hindi) | **HTTP 502** “live AI service could not complete” |
| Off-topic (cricket WC) | **HTTP 200** correct refuse (gate works **without** LLM) |
| Overall useful chat success on 8-call probe | **~12%** (1/8) |
| In-scope answer success | **~0%** |
| Offline golden / eval:all scored report | **Not run** — Q-banks exist, no pass% |

**Implication:** Policy refuse works. LLM path is broken on Vercel. Jury will fail the demo if this stays.

**Highest-priority engineering task:** set `XAI_API_KEY` on Vercel Production **and** Preview → Redeploy → re-probe 20–50 queries. Then run `npm run eval:all` if pack is present.

Do **not** put “95% accuracy” or “high response rate” on slides until a scored run exists.

---

## 7. Timeline of work with this agent (Grok) — resume context

Dates are conversation time (IST, Sep 2026). This is what was already decided/built/documented — **do not redo from scratch**.

### Early (≈ 5–14 Sep 2026) — product definition

- Problem SIH26107 framed: BIS navigation for MSMEs/consumers, not generic LLM.
- Titles, uniqueness, architecture diagrams (Mermaid → PNG, white backgrounds, PPT-safe).
- Workflow locked: ASK → LOCK → RETRIEVE (sparse + dense + RRF) → GROUND → ANSWER/REFUSE.
- Uniqueness distilled for jury: lock-first, scheme router, refusal-as-feature, replaceable model, multilingual lock.
- Prototype treated as **MVP slice**, not full catalogue.

### Mid (≈ 14–16 Sep) — implementation + deploy

- App in TanStack/Vite (not Next.js+FastAPI as an early memory note once said — **current code is TanStack Start**).
- Chat, landing tiles, pack, policy gate, hybrid retrieve.
- User deployed on **Vercel**; keys repeatedly missing → “API key not used” / 502.
- Scroll jitter during streaming was a UX bug to fix (chat runtime fluency).
- GitHub cleanup requested: professional README, no AI-pushed look, no grok branding in docs.
- Repo `owais265/ManakMitra` README/CONTRIBUTING/.env.example/package.json repository URL fixed (wrong URL had been `forest-yonder-apex-plum.git`).
- Open PR #3 (v0.app session) **closed** to reduce “AI-generated” look.
- **Grok-pwa scaffolding left in runtime** so Grok preview still works. Do not delete `scripts/grok-pwa-*` inside Grok sandbox. For a clean Antigravity/Vercel-only fork, hide grok.com injectors from **public SIH repo** if it does not break build.

### PPT / SIH deck (≈ 16–19 Sep)

- Official SIH 6-slide template used; user also used Gamma / Napkin / Canva.
- Content produced: Proposed Solution, Technical Approach, Feasibility (INR costing), Impact, Research links, comparison table vs global tools, Gap Scanner in workflow.
- Known deck defects (still to fix if PPT is the next job):
  - Typos: Vedio, Imapct, Benifit; **Team ID blank**
  - Impact slide thin
  - Research slide thin (Drive + bis.gov.in only)
  - MVP link `grok.me` + Vercel marked “(No API KEY)” — **hurts jury**
  - Git diagram still old repo name
- Honest ranking given: idea/architecture competitive; packaging/demo not elite. Top-1% of 500 ≈ **8–15%** until demo+PPT hygiene fixed.

### Feasibility / uniqueness / future (documented, not all coded)

**Top technical feasibility (jury):** bounded pack; gate-before-retrieve; hybrid index on one Postgres; ground-then-generate; LLM-optional.

**Future production (do not fake as shipped):**  
1 Scheme-Conflict Graph · 2 Evidence Freshness Leases · 3 Refusal Analytics · 4 Dual-Rail responses · 5 Pack provenance/diff · 6 Adversarial safety harness · 7 Gap Scanner as constraint engine · 8 Multi-tenant policy profiles · 9 Offline regional packs · 10 Officer escalation packets.

PDF of simple-language future roadmap was generated for the team.

### Evaluation artefacts (team, not BIS official)

- `BIS_Chatbot_Evaluation_Framework.xlsx` — ~100 Q bank
- `ManakMitra_AI_Test_Dataset_*.xlsx`
- `ManakMitra_*StressTest*.csv` (~1M intent queries)
- PPT box title: **Team Evaluation Suite — Question Bank + RAG Stress Corpus** / **RAG Evaluation & Stress Corpus**
- Label clearly: **not a BIS publication**

### 2026-09-19–20 — docs + RAG explanation

- Professional Word doc: RAG types + flow (`ManakMitra_RAG_Types_and_Flow.docx` in project artifacts).
- This `grok.md` memory file written for **Antigravity** continuation.

---

## 8. Source files that matter (do not “clean” blindly)

```
src/routes/api/chat.ts          Chat handler (query + language)
src/lib/rag.ts                  Policy + sparse lock
src/lib/retrieve.ts             Hybrid extras
src/lib/hybrid.ts               RRF / hybrid
src/lib/intent.ts               Off-topic / social
src/lib/policy-gate.ts          Sequential locks
src/lib/official-hosts.ts       Allowlist
src/data/rag-pack.json          Authorised catalogue snapshot
data/*.csv                      Human-editable sources
data/inbox/                     Pack add inbox (official hosts only)
supabase/*.sql                  pack_docs + hybrid search
scripts/eval-*.mjs              Golden / metrics (no LLM required for metrics)
scripts/rebuild-pack.mjs
scripts/ingest-pack.ts
```

Commands:

```bash
npm run dev
npm run eval:all          # golden + rewrite + pack + M1–M10 metrics
npm run pack:rebuild
npm run pack:add
python scripts/build_rag_index.py
```

Metrics IDs M1–M10: family pin, retrieval@3, no invented IS, official URL, clarify-first, scheme mix-up 0, off-topic reject, standalone query, multilingual lock, clause honesty.

---

## 9. Instructions for Antigravity (or any other agent) — DO / DO NOT

### DO

1. **Continue this product.** Do not scaffold a new chatbot.
2. **Fix Vercel keys and 502 first** if the task is “make demo work.”
3. After keys: verify pack-fallback still works when LLM is unset.
4. Keep lock-first order. Never retrieve before policy.
5. Keep three exits. Never force an answer.
6. Keep scheme separation (ISI / CRS / HUID / labs).
7. Keep UI language lock.
8. Keep allowlisted hosts only.
9. When asked for metrics, **measure or say unmeasured**. Never invent accuracy.
10. After user exports to another platform: check env, `/api/chat` contract, Vercel Production+Preview, GitHub public, README, no grok.me as primary PPT link.
11. Explain in simple English/Hinglish if Owais asks — he prefers step-by-step, not assumed DevOps fluency.
12. SIH PPT: official 6-slide template; human-looking; no blur; white diagrams; fill Team ID; proofread.

### DO NOT

1. Do not dump paid IS PDFs into the pack.
2. Do not add a live unofficial BIS scrape.
3. Do not mix schemes without a trap/refuse.
4. Do not add auth/login for the public demo unless asked.
5. Do not replace TanStack with Next.js/FastAPI “because RAG tutorials do that.”
6. Do not claim Gap Scanner issues certificates.
7. Do not delete eval scripts or pack to “simplify.”
8. Do not commit `.env` / real keys.
9. Do not put secrets in `VITE_` / client bundles.
10. Do not reopen v0 branding, “Created with Grok” in **jury-facing** README.
11. Do not mark future roadmap items as already shipped.
12. Do not change problem statement to 26108.
13. Do not “improve” prompts by allowing speculation when pack is empty.
14. Do not rewrite uniqueness into generic “multilingual AI chatbot.”

### If something looks broken

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| 400 Please enter your question | Wrong JSON body | Use `{ query, language }` |
| 502 live AI could not complete | Missing/invalid `XAI_API_KEY` on Vercel | Set key both envs, Redeploy |
| Off-topic works, product Q fails | Gate OK, LLM path down | Same as above; pack fallback should still fire — if not, bug in chat.ts |
| Hallucinated fees | Prompt/pack leak | Empty pack must refuse |
| Mix-scheme answered | Gate regression | Restore scheme lock **before** retrieve |

---

## 10. Post-export checklist (user said: after I export, check everything)

When the repo is opened on Antigravity / Cursor / etc., run this **before** new features:

- [ ] `package.json` name `manakmitra`, repo URL `owais265/ManakMitra`
- [ ] `.env.example` has no real keys; documents XAI / Supabase / HYBRID_RAG / GEMINI
- [ ] `POST /api/chat` with `{query, language}` 
- [ ] Off-topic refuse works without LLM
- [ ] In-scope pack hit returns IS + title + official URL (or clarify/refuse, never 502)
- [ ] No `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE`
- [ ] GitHub public if jury must open it
- [ ] README has no grok-4.5 / grok.me as the story
- [ ] PPT MVP link = working Vercel, not “(No API KEY)”
- [ ] `npm run eval:all` or at least `eval:metrics` if Node 22 + pack present
- [ ] Landing + chat routes exist
- [ ] Language lock still in `SYSTEM_PROMPT` in `api/chat.ts`

If all boxes pass: **continue from LAST STATE**. If 502 remains: **stop feature work; fix env.**

---

## 11. LAST STATE (start here)

**Date:** 2026-09-20 IST

**What exists:** Working codebase (lock-first hybrid RAG, pack, chat UI, eval scripts, SIH docs). GitHub README cleaned. Architecture and PPT copy largely written.

**What is broken / incomplete:**

1. **Live Vercel in-scope chat 502** — API key / LLM path. **This is the #1 job.**
2. Pack-only fallback should still serve sourced replies when LLM is down — verify and fix if 502 happens instead of fallback.
3. GitHub may still be private; gitdiagram URL stale.
4. SIH PPT polish: Team ID, typos, Impact slide, Research slide, remove grok.me / “No API KEY”.
5. No scored golden-set report yet.
6. Future 10-item roadmap is **design only**.
7. Gap Scanner: described in slides; do not over-claim vs actual UI.

**Recommended next actions (priority order):**

1. Verify Vercel env `XAI_API_KEY` Production+Preview → Redeploy → measure 20 queries (Allow/Clarify/Refuse + latency).
2. If LLM unset, confirm pack fallback (no 502).
3. Public GitHub + update diagram links to `ManakMitra`.
4. Optional: `npm run eval:all` → real metric table for PPT.
5. PPT hygiene.
6. Only then: Gap Scanner UI, freshness dates, scheme-conflict graph — as **new** work, labelled future if not demo-ready.

**Success for SIH demo:** judges see (a) sourced IS row, (b) mix-scheme refuse, (c) off-topic refuse, in under a minute. Not 100% catalogue coverage.

---

## 12. Voice / user preferences

- User often writes Hinglish; deliverables for jury in **professional English**.
- Wants compact PPT bullets, white diagrams, no blur, human-made look.
- Wants honesty over fake metrics.
- Beginner-friendly steps when teaching deploy/Git.
- Do not add Grok/v0/Cursor watermarks on SIH artefacts.

---

*End of grok.md. Any other agent: obey this file over generic RAG tutorials.*
