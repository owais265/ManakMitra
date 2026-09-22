# Security

## Reporting

If you find a vulnerability, email the maintainers privately. Do **not** open a public issue with secrets, keys, or exploit details.

## Secrets

- Never commit `.env`, `.env.local`, or API keys.
- Chat LLM uses **server-only** `XAI_API_KEY` first, then `XAI_API_KEY_2`.
- Hybrid RAG uses **server-only** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `GEMINI_API_KEY` is server-only (phrasing fallback if xAI fails, plus embeddings ingest).
- Do not expose the Supabase service role in browser / `VITE_` / `NEXT_PUBLIC_` variables.

## Data policy

ManakMitra stores **catalogue metadata** (IS number, title, official URL, scheme, lab name/city). It does **not** store paid IS clause text or full-standard PDFs.

Official hosts only: `bis.gov.in`, `manakonline.in`, `crsbis.in`, `standardsbis.bsbedge.com`, `india.gov.in`, `lims.bis.gov.in`.
