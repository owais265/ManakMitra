-- Hybrid Sparse + Dense RAG with Metadata Filter and Policy Gate
-- pack_docs is 768-d (Gemini text-embedding-004). Do NOT rank from leftover
-- public.bis_pack_data (vector 256 hash theatre).
--
-- SQL editor: CREATE / GRANT / FUNCTION return "Success. No rows returned".
-- That is expected. Tables start EMPTY until ingest. Then run:
--   select count(*) as pack_docs from pack_docs;
--   select count(*) as query_logs from query_logs;
--   select proname from pg_proc where proname in
--     ('match_pack_docs','search_pack_docs_trgm','search_pack_docs_hybrid','upsert_pack_docs');

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists pack_docs (
  id uuid primary key default uuid_generate_v4(),
  source_hash text unique not null,
  kind text not null check (kind in
    ('standard','crs','lab','faq','process','hallmark','consumer','link','product')),
  is_number text,
  title text not null,
  url text not null,
  host text not null,
  scheme text,
  family text,
  group_name text,
  extra jsonb not null default '{}',
  text text not null,
  embedding extensions.vector(768),
  ingested_at timestamptz not null default now()
);

create index if not exists pack_docs_trgm on pack_docs using gin (title gin_trgm_ops);
create index if not exists pack_docs_kind on pack_docs (kind);
create index if not exists pack_docs_is on pack_docs (is_number);
create index if not exists pack_docs_family on pack_docs (family);
create index if not exists pack_docs_scheme on pack_docs (scheme);
create index if not exists pack_docs_hnsw
  on pack_docs using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create table if not exists query_logs (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  intent text,
  refused boolean not null default false,
  pin text,
  latency_ms int,
  created_at timestamptz not null default now()
);

alter table pack_docs enable row level security;
alter table query_logs enable row level security;

revoke all on table pack_docs from anon, authenticated, public;
revoke all on table query_logs from anon, authenticated, public;
grant all on table pack_docs to service_role;
grant all on table query_logs to service_role;

create or replace function match_pack_docs(
  query_embedding extensions.vector(768),
  match_count int default 8,
  filter_kind text default null,
  filter_family text default null,
  filter_scheme text default null
)
returns table (
  id uuid,
  kind text,
  is_number text,
  title text,
  url text,
  host text,
  scheme text,
  family text,
  group_name text,
  extra jsonb,
  body text,
  score float4
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id,
    p.kind,
    p.is_number,
    p.title,
    p.url,
    p.host,
    p.scheme,
    p.family,
    p.group_name,
    p.extra,
    p.text as body,
    (1 - (p.embedding <=> query_embedding))::float4 as score
  from pack_docs p
  where p.embedding is not null
    and (filter_kind is null or p.kind = filter_kind)
    and (filter_family is null or p.family = filter_family)
    and (filter_scheme is null or p.scheme = filter_scheme)
  order by p.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 8), 32));
$$;

create or replace function search_pack_docs_trgm(
  q text,
  match_count int default 8,
  filter_kind text default null,
  filter_family text default null
)
returns table (
  id uuid,
  kind text,
  is_number text,
  title text,
  url text,
  host text,
  scheme text,
  family text,
  group_name text,
  extra jsonb,
  body text,
  score float4
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id,
    p.kind,
    p.is_number,
    p.title,
    p.url,
    p.host,
    p.scheme,
    p.family,
    p.group_name,
    p.extra,
    p.text as body,
    similarity(coalesce(p.title, ''), coalesce(q, ''))::float4 as score
  from pack_docs p
  where (filter_kind is null or p.kind = filter_kind)
    and (filter_family is null or p.family = filter_family)
    and (
      p.title % q
      or p.title ilike '%' || q || '%'
      or (p.is_number is not null and p.is_number = q)
    )
  order by similarity(coalesce(p.title, ''), coalesce(q, '')) desc
  limit greatest(1, least(coalesce(match_count, 8), 32));
$$;

create or replace function upsert_pack_docs(docs jsonb)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  rec jsonb;
  ins int := 0;
  skip int := 0;
begin
  if docs is null or jsonb_typeof(docs) <> 'array' then
    return jsonb_build_object('inserted', 0, 'skipped', 0, 'error', 'docs must be a json array');
  end if;
  for rec in select value from jsonb_array_elements(docs)
  loop
    insert into pack_docs (
      source_hash, kind, is_number, title, url, host, scheme, family, group_name, extra, text
    ) values (
      rec->>'source_hash',
      rec->>'kind',
      nullif(rec->>'is_number', ''),
      rec->>'title',
      rec->>'url',
      rec->>'host',
      nullif(rec->>'scheme', ''),
      nullif(rec->>'family', ''),
      nullif(rec->>'group_name', ''),
      coalesce(rec->'extra', '{}'::jsonb),
      rec->>'text'
    )
    on conflict (source_hash) do nothing;
    if found then
      ins := ins + 1;
    else
      skip := skip + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', ins, 'skipped', skip);
end;
$$;

create or replace function search_pack_docs_hybrid(
  q text,
  query_embedding extensions.vector default null,
  match_count int default 8,
  filter_kind text default null,
  filter_family text default null,
  filter_scheme text default null,
  extra_cap int default 3
)
returns table (
  id uuid,
  kind text,
  is_number text,
  title text,
  url text,
  host text,
  scheme text,
  family text,
  group_name text,
  extra jsonb,
  body text,
  score float4,
  lane text
)
language sql
stable
set search_path = public, extensions
as $$
  with vec as (
    select m.id, m.kind, m.is_number, m.title, m.url, m.host, m.scheme, m.family,
           m.group_name, m.extra, m.body, m.score,
           row_number() over (order by m.score desc) as rnk
    from public.match_pack_docs(query_embedding, 16, filter_kind, filter_family, filter_scheme) m
    where query_embedding is not null
  ),
  txt as (
    select t.id, t.kind, t.is_number, t.title, t.url, t.host, t.scheme, t.family,
           t.group_name, t.extra, t.body, t.score,
           row_number() over (order by t.score desc) as rnk
    from public.search_pack_docs_trgm(q, 16, filter_kind, filter_family) t
    where q is not null and length(trim(q)) >= 2
      and (filter_scheme is null or t.scheme is null or t.scheme = filter_scheme)
  ),
  fused as (
    select coalesce(v.id, x.id) as id,
           coalesce(v.kind, x.kind) as kind,
           coalesce(v.is_number, x.is_number) as is_number,
           coalesce(v.title, x.title) as title,
           coalesce(v.url, x.url) as url,
           coalesce(v.host, x.host) as host,
           coalesce(v.scheme, x.scheme) as scheme,
           coalesce(v.family, x.family) as family,
           coalesce(v.group_name, x.group_name) as group_name,
           coalesce(v.extra, x.extra) as extra,
           coalesce(v.body, x.body) as body,
           (
             coalesce(1.0 / (60 + v.rnk), 0) +
             coalesce(1.0 / (60 + x.rnk), 0)
           )::float4 as score,
           case
             when v.id is not null and x.id is not null then 'both'
             when v.id is not null then 'dense'
             else 'sparse'
           end as lane
    from vec v
    full outer join txt x on v.id = x.id
  )
  select f.id, f.kind, f.is_number, f.title, f.url, f.host, f.scheme, f.family,
         f.group_name, f.extra, f.body, f.score, f.lane
  from fused f
  order by f.score desc
  limit greatest(1, least(coalesce(extra_cap, 3), coalesce(match_count, 8), 8));
$$;

revoke all on function match_pack_docs(extensions.vector, int, text, text, text) from public, anon, authenticated;
revoke all on function search_pack_docs_trgm(text, int, text, text) from public, anon, authenticated;
revoke all on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) from public, anon, authenticated;
revoke all on function upsert_pack_docs(jsonb) from public, anon, authenticated;
grant execute on function match_pack_docs(extensions.vector, int, text, text, text) to service_role;
grant execute on function search_pack_docs_trgm(text, int, text, text) to service_role;
grant execute on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) to service_role;
grant execute on function upsert_pack_docs(jsonb) to service_role;
