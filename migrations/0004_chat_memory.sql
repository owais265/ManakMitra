-- Guest question cap (one row per browser session) and signed-in chat threads.
-- Threads belong to the Better Auth user id and expire 24 hours after the last save.
-- No row level security: the app server is the only writer and scopes by user_id.

create table if not exists mm_guest_quota (
  guest_id text primary key,
  used integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists mm_threads (
  user_id text not null,
  id text not null,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, id)
);

create index if not exists mm_threads_user_updated_idx
  on mm_threads (user_id, updated_at desc);
