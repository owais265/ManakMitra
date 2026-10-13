-- Okapi BM25 lane for pack_docs. Not ts_rank. Not pg_trgm.
-- Candidate gen uses the GIN index on tsv (rarest query term) plus the is_number btree.
-- df comes from pack_term_df (ts_stat). A missing term adds 0. No seq scan of pack_docs on the hot path.
-- tf is the tsvector position count for that same lexeme, so tf and df share the simple tokenizer.
-- Hindi lexemes the parser keeps are not stripped. Query stopwords: standard, mark, bis, and the English list below.
-- Exact is_number match adds an exact-id prior of 1000 so it outranks a fuzzy title hit.
-- That prior is not part of the BM25 sum. RRF uses rank, not this raw score.
--
-- k1 = 1.2, b = 0.75
-- idf(t) = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))
-- tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))

alter table pack_docs add column if not exists doc_len int;
alter table pack_docs add column if not exists tsv tsvector;

create index if not exists pack_docs_tsv on pack_docs using gin (tsv);

create table if not exists pack_term_df (
  term text primary key,
  df int not null
);

create table if not exists pack_bm25_stats (
  id int primary key,
  n int not null,
  avgdl float8 not null
);

alter table pack_term_df enable row level security;
alter table pack_bm25_stats enable row level security;
revoke all on table pack_term_df from anon, authenticated, public;
revoke all on table pack_bm25_stats from anon, authenticated, public;
grant all on table pack_term_df to service_role;
grant all on table pack_bm25_stats to service_role;

create or replace function refresh_pack_bm25_batch(batch_size int default 400)
returns int
language plpgsql
set search_path = public, extensions
set statement_timeout = '120s'
as $fn$
declare
  n int;
begin
  with todo as (
    select id from pack_docs where tsv is null limit greatest(1, least(coalesce(batch_size, 400), 2000))
  ),
  upd as (
    update pack_docs p
    set
      tsv = to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.text, '')),
      doc_len = greatest(
        1,
        coalesce((
          select sum(cardinality(u.positions))::int
          from unnest(to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.text, ''))) as u(lexeme, positions, weights)
        ), 1)
      )
    from todo
    where p.id = todo.id
    returning 1
  )
  select count(*)::int into n from upd;
  return coalesce(n, 0);
end;
$fn$;

create or replace function refresh_pack_bm25_stats()
returns void
language plpgsql
set search_path = public, extensions
set statement_timeout = '180s'
as $fn$
declare
  n_docs int;
  avg_dl float8;
begin
  select count(*)::int, coalesce(avg(doc_len), 1) into n_docs, avg_dl
  from pack_docs
  where tsv is not null and doc_len is not null and doc_len > 0;
  delete from pack_term_df;
  insert into pack_term_df(term, df)
  select word, ndoc::int
  from ts_stat($$select tsv from pack_docs where tsv is not null$$)
  where ndoc > 0;
  insert into pack_bm25_stats(id, n, avgdl)
  values (1, coalesce(n_docs, 0), greatest(coalesce(avg_dl, 1), 1))
  on conflict (id) do update set n = excluded.n, avgdl = excluded.avgdl;
end;
$fn$;

create or replace function search_pack_docs_bm25(
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
language plpgsql
stable
set search_path = public, extensions
set statement_timeout = '8s'
set enable_seqscan = off
as $fn$
begin
  return query
  with qtok as (
    select distinct u.lexeme as tok
    from unnest(to_tsvector('simple', coalesce(q, ''))) as u(lexeme, positions, weights)
    where char_length(u.lexeme) > 1
      and u.lexeme not in (
        'standard','standards','mark','bis','the','and','for','with','from','that','this',
        'product','products','indian','what','how','are','was','were','you','your','is'
      )
  ),
  digits as (
    select distinct m[1] as tok
    from regexp_matches(coalesce(q, ''), '[0-9]{3,5}', 'g') as m
  ),
  stats as (
    select s.n, s.avgdl from pack_bm25_stats s where s.id = 1 and s.n > 0
  ),
  df as (
    select t.tok, coalesce(s.df, 0) as df
    from qtok t
    left join pack_term_df s on s.term = t.tok
  ),
  rare as (
    select d.tok
    from df d
    where d.df > 0
    order by d.df asc, d.tok asc
    limit 1
  ),
  gin_cands as (
    select p.id
    from pack_docs p
    where exists (select 1 from stats)
      and exists (select 1 from rare)
      and p.tsv @@ plainto_tsquery('simple', (select r.tok from rare r))
      and (filter_kind is null or p.kind = filter_kind)
      and (filter_family is null or p.family = filter_family)
    limit 400
  ),
  id_cands as (
    select p.id
    from pack_docs p
    join digits d on p.is_number = d.tok
    where (filter_kind is null or p.kind = filter_kind)
      and (filter_family is null or p.family = filter_family)
  ),
  cands as (
    select gin_cands.id from gin_cands
    union
    select id_cands.id from id_cands
  ),
  scored as (
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
      (
        coalesce((
          select sum(
            ln(1 + greatest((st.n - d.df + 0.5) / (d.df + 0.5), 0))
            * (
              (tf.tf * (1.2 + 1))
              / (
                tf.tf + 1.2 * (1 - 0.75 + 0.75 * (p.doc_len::float8 / greatest(st.avgdl, 1)))
              )
            )
          )
          from df d
          cross join stats st
          cross join lateral (
            select case
              when d.df <= 0 or p.doc_len is null or p.doc_len <= 0 or p.tsv is null then 0::float8
              else coalesce((
                select cardinality(u.positions)::float8
                from unnest(p.tsv) as u(lexeme, positions, weights)
                where u.lexeme = d.tok
              ), 0)
            end as tf
          ) tf
          where tf.tf > 0
        ), 0)
        + case when p.is_number in (select digits.tok from digits) then 1000 else 0 end
      )::float4 as score
    from pack_docs p
    join cands c on c.id = p.id
  )
  select
    scored.id, scored.kind, scored.is_number, scored.title, scored.url, scored.host,
    scored.scheme, scored.family, scored.group_name, scored.extra, scored.body, scored.score
  from scored
  where scored.score > 0
  order by scored.score desc
  limit greatest(1, least(coalesce(match_count, 8), 32));
end;
$fn$;

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

revoke all on function refresh_pack_bm25_batch(int) from public, anon, authenticated;
revoke all on function refresh_pack_bm25_stats() from public, anon, authenticated;
revoke all on function search_pack_docs_bm25(text, int, text, text) from public, anon, authenticated;
revoke all on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) from public, anon, authenticated;
grant execute on function refresh_pack_bm25_batch(int) to service_role;
grant execute on function refresh_pack_bm25_stats() to service_role;
grant execute on function search_pack_docs_bm25(text, int, text, text) to service_role;
grant execute on function search_pack_docs_hybrid(text, extensions.vector, int, text, text, text, int) to service_role;
