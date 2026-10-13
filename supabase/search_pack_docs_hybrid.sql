-- Three-lane RRF for pack extras. k = 60.
-- RRF(d) = 1/(60+rank_dense) + 1/(60+rank_bm25) + 1/(60+rank_trgm)
-- A missing lane adds 0. Rank only. Do not add raw cosine to raw BM25.
-- BM25 function, tsv, and stats live in search_pack_docs_bm25.sql.
-- Apply that file (it replaces this function too). Default extra_cap is 3. Hard cap 20.

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
  id uuid, kind text, is_number text, title text, url text, host text,
  scheme text, family text, group_name text, extra jsonb, body text,
  score float4, lane text
)
language sql
stable
set search_path = public, extensions
set statement_timeout = '8s'
as $$
  with vec as (
    select m.id, m.kind, m.is_number, m.title, m.url, m.host, m.scheme, m.family,
           m.group_name, m.extra, m.body, m.score,
           row_number() over (order by m.score desc) as rnk
    from public.match_pack_docs(query_embedding, 16, filter_kind, filter_family, filter_scheme) m
    where query_embedding is not null
  ),
  bm as (
    select b.id, b.kind, b.is_number, b.title, b.url, b.host, b.scheme, b.family,
           b.group_name, b.extra, b.body, b.score,
           row_number() over (order by b.score desc) as rnk
    from public.search_pack_docs_bm25(q, 16, filter_kind, filter_family) b
    where q is not null and length(trim(q)) >= 2
  ),
  tr as (
    select t.id, t.kind, t.is_number, t.title, t.url, t.host, t.scheme, t.family,
           t.group_name, t.extra, t.body, t.score,
           row_number() over (order by t.score desc) as rnk
    from public.search_pack_docs_trgm(q, 16, filter_kind, filter_family) t
    where q is not null and length(trim(q)) >= 2
      and (filter_scheme is null or t.scheme is null or t.scheme = filter_scheme)
  ),
  ids as (
    select vec.id from vec
    union
    select bm.id from bm
    union
    select tr.id from tr
  ),
  fused as (
    select coalesce(v.id, b.id, t.id) as id,
           coalesce(v.kind, b.kind, t.kind) as kind,
           coalesce(v.is_number, b.is_number, t.is_number) as is_number,
           coalesce(v.title, b.title, t.title) as title,
           coalesce(v.url, b.url, t.url) as url,
           coalesce(v.host, b.host, t.host) as host,
           coalesce(v.scheme, b.scheme, t.scheme) as scheme,
           coalesce(v.family, b.family, t.family) as family,
           coalesce(v.group_name, b.group_name, t.group_name) as group_name,
           coalesce(v.extra, b.extra, t.extra) as extra,
           coalesce(v.body, b.body, t.body) as body,
           (
             coalesce(1.0 / (60 + v.rnk), 0) +
             coalesce(1.0 / (60 + b.rnk), 0) +
             coalesce(1.0 / (60 + t.rnk), 0)
           )::float4 as score,
           case
             when (v.id is not null)::int + (b.id is not null)::int + (t.id is not null)::int > 1 then 'both'
             when v.id is not null then 'dense'
             when b.id is not null then 'bm25'
             else 'trgm'
           end as lane
    from ids i
    left join vec v on v.id = i.id
    left join bm b on b.id = i.id
    left join tr t on t.id = i.id
  )
  select f.id, f.kind, f.is_number, f.title, f.url, f.host, f.scheme, f.family,
         f.group_name, f.extra, f.body, f.score, f.lane
  from fused f
  order by f.score desc
  limit greatest(1, least(coalesce(extra_cap, 3), 20));
$$;

revoke all on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) from public, anon, authenticated;
grant execute on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) to service_role;
