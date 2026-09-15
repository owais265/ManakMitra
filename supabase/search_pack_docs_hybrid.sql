-- Paste this block in the Supabase SQL editor (same project as pack_docs).
-- CREATE returns "Success. No rows returned" — that is OK.

create or replace function public.search_pack_docs_hybrid(
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

revoke all on function public.search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) from public, anon, authenticated;
grant execute on function public.search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) to service_role;
