-- ═══════════════════════════════════════════════════════════════════
-- Results persistence for username/password accounts (app_users).
--
-- HOW TO APPLY (one time):
--   1. Resume the project at https://supabase.com/dashboard (free tier
--      pauses after ~1 week of inactivity; it currently returns 521).
--   2. Open SQL Editor → paste this whole file → Run. Safe to re-run.
--
-- WHY: the app logs in via app_login/app_signup RPCs (our own app_users
-- table — NOT Supabase Auth), so supabase.auth.getSession() is always
-- empty and the old test_results path never saved anything. Results now
-- go through the same security-definer RPC pattern as login, keyed by
-- the app_users.id that app_login returns.
--
-- NOTE: assumes app_users.id is uuid (gen_random_uuid in app_signup).
-- ═══════════════════════════════════════════════════════════════════

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

-- RLS on, and NO policies: the anon key cannot touch the table directly.
-- All access goes through the security-definer functions below.
alter table public.app_results enable row level security;

create or replace function public.app_save_result(
  p_user_id uuid,
  p_test_type text,
  p_score integer,
  p_total integer,
  p_passed boolean,
  p_details jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
) returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from app_users where id = p_user_id) then
    return json_build_object('error', 'invalid user');
  end if;
  -- Ignore exact duplicates so the client's offline re-sync is idempotent.
  if exists (
    select 1 from app_results
    where user_id = p_user_id
      and test_type = p_test_type
      and created_at = coalesce(p_created_at, now())
  ) then
    return json_build_object('ok', true, 'duplicate', true);
  end if;
  insert into app_results (user_id, test_type, score, total, passed, details, created_at)
  values (p_user_id, p_test_type, p_score, p_total, p_passed,
          coalesce(p_details, '{}'::jsonb), coalesce(p_created_at, now()));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.app_get_results(p_user_id uuid)
returns setof public.app_results
language sql security definer stable set search_path = public
as $$
  select * from app_results where user_id = p_user_id order by created_at desc;
$$;

grant execute on function public.app_save_result(uuid, text, integer, integer, boolean, jsonb, timestamptz) to anon, authenticated;
grant execute on function public.app_get_results(uuid) to anon, authenticated;
