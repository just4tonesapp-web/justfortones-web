-- ═══════════════════════════════════════════════════════════════════
-- Just4Tones — FULL database bootstrap for a FRESH Supabase project.
-- Paste this whole file once into SQL Editor → Run. Safe to re-run.
--
-- Recreates everything the app needs (the original app_users/app_login
-- SQL from June 2026 was never committed; this reconstructs it to match
-- the client contract in authView.js exactly):
--   1. app_users + app_signup/app_login (bcrypt via pgcrypto)
--   2. app_results + app_save_result/app_get_results
--   3. accuracy_log (+ anon insert policy — client inserts directly)
--   4. app_analytics() aggregate RPC
-- All tables have RLS on with NO select policies: reads/writes go through
-- security-definer RPCs keyed by app_users.id (the app does NOT use
-- Supabase Auth), except accuracy_log which allows bare inserts.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Accounts ──────────────────────────────────────────────────────
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  pass_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.app_users enable row level security;

create or replace function public.app_signup(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public
as $$
declare u app_users;
begin
  if p_username is null or length(p_username) < 3 or p_username !~ '^[a-z0-9._-]+$'
     or p_password is null or length(p_password) < 6 then
    return json_build_object('error', 'invalid input');
  end if;
  if exists (select 1 from app_users where username = p_username) then
    return json_build_object('error', 'username taken');
  end if;
  insert into app_users (username, pass_hash)
  values (p_username, extensions.crypt(p_password, extensions.gen_salt('bf')))
  returning * into u;
  return json_build_object('id', u.id, 'username', u.username);
end $$;

create or replace function public.app_login(p_username text, p_password text)
returns json language plpgsql security definer set search_path = public
as $$
declare u app_users;
begin
  select * into u from app_users where username = p_username;
  if u.id is null or u.pass_hash <> extensions.crypt(p_password, u.pass_hash) then
    return json_build_object('error', 'invalid');
  end if;
  return json_build_object('id', u.id, 'username', u.username);
end $$;

grant execute on function public.app_signup(text, text) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;

-- ── 2. Results (tests A/B/C + practices P1/P2/P3) ────────────────────
create table if not exists public.app_results (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  test_type text not null,
  score integer not null,
  total integer not null,
  passed boolean not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists app_results_user_created_idx
  on public.app_results (user_id, created_at desc);
alter table public.app_results enable row level security;

create or replace function public.app_save_result(
  p_user_id uuid, p_test_type text, p_score integer, p_total integer,
  p_passed boolean, p_details jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
) returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from app_users where id = p_user_id) then
    return json_build_object('error', 'invalid user');
  end if;
  if exists (
    select 1 from app_results
    where user_id = p_user_id and test_type = p_test_type
      and created_at = coalesce(p_created_at, now())
  ) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;
  insert into app_results (user_id, test_type, score, total, passed, details, created_at)
  values (p_user_id, p_test_type, p_score, p_total, p_passed,
          coalesce(p_details, '{}'::jsonb), coalesce(p_created_at, now()));
  return json_build_object('ok', true);
end $$;

create or replace function public.app_get_results(p_user_id uuid)
returns setof public.app_results
language sql security definer stable set search_path = public
as $$
  select * from app_results where user_id = p_user_id order by created_at desc;
$$;

grant execute on function public.app_save_result(uuid, text, integer, integer, boolean, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.app_get_results(uuid) to anon, authenticated;

-- ── 3. Model-accuracy log (debug-mode votes; client inserts directly) ─
create table if not exists public.accuracy_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  session_id text,
  question_num integer,
  "char" text,
  base text,
  target_tone integer,
  ensemble_tone integer,
  confidence numeric,
  agreement numeric,
  azure_vote integer,
  pitch_vote integer,
  groq_vote integer,
  groq_turbo_vote integer,
  google_vote integer,
  deepgram_vote integer,
  whisper_vote integer,
  classifier_vote integer,
  auto_correct boolean,
  user_correct boolean,
  created_at timestamptz not null default now()
);
alter table public.accuracy_log enable row level security;
drop policy if exists accuracy_log_insert on public.accuracy_log;
create policy accuracy_log_insert on public.accuracy_log
  for insert to anon, authenticated with check (true);

-- ── 4. Aggregate analytics (counts/averages only — safe for anon) ────
create or replace function public.app_analytics()
returns jsonb
language sql security definer stable set search_path = public
as $$
select jsonb_build_object(
  'generated_at', now(),
  'total_users', (
    select count(*) from app_users where username <> 'smoketest.claude'
  ),
  'results_total', (
    select count(*) from app_results r
    where not exists (select 1 from app_users u where u.id = r.user_id and u.username = 'smoketest.claude')
  ),
  'first_activity', (select min(created_at) from app_results),
  'last_activity',  (select max(created_at) from app_results),
  'by_type', (
    select coalesce(jsonb_object_agg(test_type, stats order by test_type), '{}'::jsonb)
    from (
      select test_type,
             jsonb_build_object(
               'attempts', count(*),
               'users', count(distinct user_id),
               'avg_score_pct', round(avg(100.0 * score / nullif(total, 0))),
               'pass_rate_pct', round(avg(case when passed then 100.0 else 0 end))
             ) as stats
      from app_results
      group by test_type
    ) t
  ),
  'active_users_by_day', (
    select coalesce(jsonb_object_agg(d, n order by d), '{}'::jsonb)
    from (
      select to_char(created_at::date, 'YYYY-MM-DD') as d,
             count(distinct user_id) as n
      from app_results group by 1
    ) t
  ),
  'returning_users', (
    select count(*) from (
      select user_id from app_results
      group by user_id having count(distinct created_at::date) >= 2
    ) t
  ),
  'accuracy_log_rows', (select count(*) from accuracy_log),
  'ensemble_accuracy_pct', (
    select round(avg(case when user_correct then 100.0 else 0 end))
    from accuracy_log where user_correct is not null
  ),
  'model_accuracy_pct', (
    select jsonb_build_object(
      'pitch',    round(avg(case when pitch_vote    = target_tone then 100.0 else 0 end)),
      'google',   round(avg(case when google_vote   = target_tone then 100.0 else 0 end)),
      'azure',    round(avg(case when azure_vote    = target_tone then 100.0 else 0 end)),
      'deepgram', round(avg(case when deepgram_vote = target_tone then 100.0 else 0 end)),
      'openrouter', null
    )
    from accuracy_log where user_correct is true
  )
);
$$;

grant execute on function public.app_analytics() to anon, authenticated;
