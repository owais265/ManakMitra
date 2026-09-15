# Add data here (easy)

1. Drop a `.json` or `.csv` file in this folder.
2. JSON = array of `{id, kind, title, body, url}` or `{ "chunks": [ ... ] }`.
3. URL must be official (`bis.gov.in`, `manakonline.in`, `crsbis.in`, `standardsbis.bsbedge.com`, `india.gov.in`, `lims.bis.gov.in`, `huid.manakonline.in`).
4. Run `npm run pack:add`
5. That upserts Supabase + updates `src/data/inbox-boost.json` so chat sees it without a full TF-IDF rebuild.

Do not put paid clause PDFs or fake IS numbers here.
