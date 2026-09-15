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
--   5. classes + teacher-dashboard RPCs (app_create_class, app_join_class,
--      app_teacher_classes/roster/class_stats/student_results/class_results)
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

-- Classes (teacher dashboard). A user is "a teacher" purely by owning a row
-- here (classes.teacher_id) — is_teacher below is only the allowlist bit
-- that gates who may CREATE one. One class per student at a time (class_id
-- is a plain column, not a join table) — matches the pilot's actual scale.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  teacher_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;

alter table public.app_users add column if not exists is_teacher boolean not null default false;
alter table public.app_users add column if not exists class_id uuid references public.classes(id);
alter table public.app_users add column if not exists class_joined_at timestamptz;
-- Stated separately (not inline above) because `add column if not exists` is
-- skipped entirely on a database that already has the column. Without
-- `on delete set null` here, the `on delete cascade` on classes.teacher_id can
-- never fire: deleting a teacher aborts on the students still referencing the class.
alter table public.app_users drop constraint if exists app_users_class_id_fkey;
alter table public.app_users add constraint app_users_class_id_fkey
  foreign key (class_id) references public.classes(id) on delete set null;

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
declare u app_users; c classes;
begin
  select * into u from app_users where username = p_username;
  if u.id is null or u.pass_hash <> extensions.crypt(p_password, u.pass_hash) then
    return json_build_object('error', 'invalid');
  end if;
  if u.class_id is not null then
    select * into c from classes where id = u.class_id;
  end if;
  return json_build_object(
    'id', u.id, 'username', u.username, 'is_teacher', u.is_teacher,
    'class_id', u.class_id, 'class_name', c.name, 'class_code', c.code
  );
end $$;

-- Re-read the session fields app_login returns, for a client whose cached
-- session predates a change made in the database (is_teacher being flipped,
-- or a class joined on another device).
create or replace function public.app_session(p_user_id uuid)
returns json language plpgsql security definer stable set search_path = public
as $$
declare u app_users; c classes;
begin
  select * into u from app_users where id = p_user_id;
  if u.id is null then
    return json_build_object('error', 'invalid user');
  end if;
  if u.class_id is not null then
    select * into c from classes where id = u.class_id;
  end if;
  return json_build_object(
    'id', u.id, 'username', u.username, 'is_teacher', u.is_teacher,
    'class_id', u.class_id, 'class_name', c.name, 'class_code', c.code
  );
end $$;

grant execute on function public.app_session(uuid) to anon, authenticated;
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
    select count(*) from app_users where username not like 'smoketest.claude%'
  ),
  'results_total', (
    select count(*) from app_results r
    where not exists (select 1 from app_users u where u.id = r.user_id and u.username like 'smoketest.claude%')
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

-- ── 5. Classes & teacher dashboard ────────────────────────────────────
create or replace function public.app_create_class(p_teacher_id uuid, p_name text)
returns json language plpgsql security definer set search_path = public
as $$
declare
  is_t boolean;
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  tries int := 0;
  new_row classes;
begin
  select is_teacher into is_t from app_users where id = p_teacher_id;
  if is_t is not true then
    return json_build_object('error', 'not a teacher');
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    return json_build_object('error', 'name required');
  end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from classes where code = new_code);
    tries := tries + 1;
    if tries > 20 then
      return json_build_object('error', 'could not generate a unique code, try again');
    end if;
  end loop;
  insert into classes (code, name, teacher_id)
  values (new_code, trim(p_name), p_teacher_id)
  returning * into new_row;
  return json_build_object('id', new_row.id, 'code', new_row.code, 'name', new_row.name);
end $$;

create or replace function public.app_join_class(p_user_id uuid, p_code text)
returns json language plpgsql security definer set search_path = public
as $$
declare cl classes;
begin
  select * into cl from classes where code = upper(trim(p_code));
  if cl.id is null then
    return json_build_object('error', 'invalid code');
  end if;
  -- Same existence guard app_save_result uses. Without it a stale or bogus uuid
  -- updated zero rows and still returned ok:true.
  if not exists (select 1 from app_users where id = p_user_id) then
    return json_build_object('error', 'invalid user');
  end if;
  -- A teacher enrolled in their own class is counted as a student in every
  -- roster, stat and tone number they then read, and there is no un-join path.
  if cl.teacher_id = p_user_id then
    return json_build_object('error', 'you are the teacher of this class');
  end if;
  update app_users set class_id = cl.id, class_joined_at = now() where id = p_user_id;
  return json_build_object('ok', true, 'class_id', cl.id, 'class_name', cl.name, 'class_code', cl.code);
end $$;

create or replace function public.app_teacher_classes(p_teacher_id uuid)
returns jsonb language sql security definer stable set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb)
  from (
    select c.id, c.code, c.name, c.created_at,
      (select count(*) from app_users u where u.class_id = c.id) as student_count
    from classes c
    where c.teacher_id = p_teacher_id
  ) t
$$;

create or replace function public.app_teacher_roster(p_teacher_id uuid, p_class_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public
as $$
declare result jsonb;
begin
  if not exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = p_teacher_id) then
    return jsonb_build_object('error', 'not found');
  end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.username), '[]'::jsonb) into result
  from (
    select u.username, u.class_joined_at,
      (select max(r.created_at) from app_results r where r.user_id = u.id) as last_activity,
      (select count(*) from app_results r where r.user_id = u.id) as total_attempts,
      (select coalesce(jsonb_object_agg(x.test_type, x.cnt order by x.test_type), '{}'::jsonb)
       from (select test_type, count(*) as cnt from app_results r where r.user_id = u.id group by test_type) x
      ) as by_type
    from app_users u
    where u.class_id = p_class_id
  ) t;
  return result;
end $$;

create or replace function public.app_teacher_class_stats(p_teacher_id uuid, p_class_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public
as $$
begin
  if not exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = p_teacher_id) then
    return jsonb_build_object('error', 'not found');
  end if;
  return (
    select jsonb_build_object(
      'generated_at', now(),
      'total_students', (select count(*) from app_users where class_id = p_class_id),
      'results_total', (
        select count(*) from app_results r join app_users u on u.id = r.user_id
        where u.class_id = p_class_id
      ),
      'by_type', (
        select coalesce(jsonb_object_agg(test_type, stats order by test_type), '{}'::jsonb)
        from (
          select r.test_type,
                 jsonb_build_object(
                   'attempts', count(*),
                   'students', count(distinct r.user_id),
                   'avg_score_pct', round(avg(100.0 * r.score / nullif(r.total, 0))),
                   'pass_rate_pct', round(avg(case when r.passed then 100.0 else 0 end))
                 ) as stats
          from app_results r join app_users u on u.id = r.user_id
          where u.class_id = p_class_id
          group by r.test_type
        ) t
      ),
      'active_students_by_day', (
        select coalesce(jsonb_object_agg(d, n order by d), '{}'::jsonb)
        from (
          select to_char(r.created_at::date, 'YYYY-MM-DD') as d, count(distinct r.user_id) as n
          from app_results r join app_users u on u.id = r.user_id
          where u.class_id = p_class_id
          group by 1
        ) t
      )
    )
  );
end $$;

drop function if exists public.app_teacher_student_results(uuid, uuid);
create or replace function public.app_teacher_student_results(p_teacher_id uuid, p_class_id uuid, p_username text)
returns table (
  test_type text, score integer, total integer, passed boolean, details jsonb, created_at timestamptz
) language plpgsql security definer stable set search_path = public
as $$
begin
  if not exists (
    select 1 from app_users u join classes c on c.id = u.class_id
    where u.username = p_username and u.class_id = p_class_id and c.teacher_id = p_teacher_id
  ) then
    return;
  end if;
  return query
    select r.test_type, r.score, r.total, r.passed, r.details, r.created_at
    from app_results r
    join app_users u on u.id = r.user_id
    where u.username = p_username and u.class_id = p_class_id
    order by r.created_at desc;
end $$;

drop function if exists public.app_teacher_class_results(uuid, uuid);
create or replace function public.app_teacher_class_results(p_teacher_id uuid, p_class_id uuid)
returns table (
  username text, test_type text, score integer,
  total integer, passed boolean, details jsonb, created_at timestamptz
) language plpgsql security definer stable set search_path = public
as $$
begin
  if not exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = p_teacher_id) then
    return;
  end if;
  return query
    select u.username, r.test_type, r.score, r.total, r.passed, r.details, r.created_at
    from app_results r
    join app_users u on u.id = r.user_id
    where u.class_id = p_class_id
    order by r.created_at desc;
end $$;

grant execute on function public.app_create_class(uuid, text) to anon, authenticated;
grant execute on function public.app_join_class(uuid, text) to anon, authenticated;
grant execute on function public.app_teacher_classes(uuid) to anon, authenticated;
grant execute on function public.app_teacher_roster(uuid, uuid) to anon, authenticated;
grant execute on function public.app_teacher_class_stats(uuid, uuid) to anon, authenticated;
grant execute on function public.app_teacher_student_results(uuid, uuid, text) to anon, authenticated;
grant execute on function public.app_teacher_class_results(uuid, uuid) to anon, authenticated;
