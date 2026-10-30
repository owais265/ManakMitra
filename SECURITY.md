# Security

## Reporting

If you find a vulnerability, email the maintainers privately. Do **not** open a public issue with secrets, keys, or exploit details.

## Secrets

- Never commit `.env`, `.env.local`, or API keys.
- Chat LLM uses **server-only** `XAI_API_KEY` first, then `XAI_API_KEY_2`.
- Hybrid RAG uses **server-only** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- `GEMINI_API_KEY` is server-only (phrasing fallback if xAI fails, plus embeddings ingest).
- Chat history is capped at the last 6 turns and 400 characters each before follow-up retrieval. A question is capped at 2,000 characters.
- WhatsApp is stopped. `/webhook` answers only when `WHATSAPP_ENABLED` is `1`.
- `WHATSAPP_VERIFY_TOKEN` is the Meta handshake only. If it is unset, `/webhook` rejects the subscription. There is no fallback in source.
- `WHATSAPP_CHAT_SECRET` is a different secret. Only the webhook may send it as `x-manak-wa` to skip the guest cap on that hop. The verify token is not accepted there.
- The chat rate limit prefers the platform `x-real-ip`. It is still per server instance, not a global quota.

## Data policy

ManakMitra stores **catalogue metadata** (IS number, title, official URL, scheme, lab name/city). It does **not** store paid IS clause text or full-standard PDFs.

Official hosts only: `bis.gov.in`, `manakonline.in`, `crsbis.in`, `standardsbis.bsbedge.com`, `india.gov.in`, `lims.bis.gov.in`.
