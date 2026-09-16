# Contributing

## Grounding rule

Every answer must come from the authorised pack or official hosts. If the catalogue has no match, **refuse**. Never invent an IS number, fee, clause, or QCO status.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Checks before a PR

```bash
npm run typecheck
npm run eval:all
```

`eval:all` runs golden + rewrite + pack + M1–M10 metrics. Metrics require **no LLM**.

## Adding a verified fact

1. Drop `{id, kind, title, body, url}` JSON/CSV in `data/inbox/`.
2. URL must be an official BIS host.
3. `npm run pack:add`
4. Re-run `npm run eval:all`.

Do not ingest paid clause PDFs, scrape dumps, or synthetic Q&A files.

## Scope

This is SIH **26107** (standards assistant), not 26108 (tender/procurement).
