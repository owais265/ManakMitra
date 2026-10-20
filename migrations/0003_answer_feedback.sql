-- Desk feedback only. Not a BIS complaint and not a chat transcript.
-- A row lives 24 hours (expires_at). The API deletes expired rows on each save.
-- pg_cron, when already installed, also deletes them hourly.
-- Service role writes. anon and authenticated have no policy and no grant.

create table if not exists public.answer_feedback (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('up', 'down', 'report')),
  query text not null default '',
  exit_note text not null default '',
  language text not null default '',
  locks jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists answer_feedback_expires_at_idx
  on public.answer_feedback (expires_at);

comment on table public.answer_feedback is
  'Useful, not useful, or wrong-answer clicks. Deleted after 24 hours. Not a BIS complaint.';

alter table public.answer_feedback enable row level security;
alter table public.answer_feedback force row level security;

revoke all on table public.answer_feedback from public;

do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.answer_feedback from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.answer_feedback from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, delete on table public.answer_feedback to service_role';
    execute 'grant usage, select on sequence public.answer_feedback_id_seq to service_role';
  end if;
end
$grant$;

create or replace function public.purge_answer_feedback()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.answer_feedback where expires_at <= now();
$$;

revoke all on function public.purge_answer_feedback() from public;

do $exec$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.purge_answer_feedback() to service_role';
  end if;
end
$exec$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-answer-feedback') then
      perform cron.unschedule('purge-answer-feedback');
    end if;
    perform cron.schedule(
      'purge-answer-feedback',
      '15 * * * *',
      'select public.purge_answer_feedback()'
    );
  end if;
exception when others then
  null;
end
$cron$;
