-- ═══════════════════════════════════════════════════════════════════
-- Soft-launch analytics RPC.
--
-- HOW TO APPLY (one time, after resuming the project):
--   Supabase dashboard → SQL Editor → paste this file → Run.
--   The last line prints the current numbers immediately; afterwards the
--   same numbers can be fetched any time via the app_analytics() RPC.
--
-- Exposes AGGREGATES ONLY (counts / averages — no usernames, no per-user
-- rows), so granting it to anon is safe. The smoke-test account is excluded.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.app_analytics()
returns jsonb
language sql security definer stable set search_path = public
as $$
select jsonb_build_object(
  'generated_at', now(),

  -- ── Accounts ──
  'total_users', (
    select count(*) from app_users where username <> 'smoketest.claude'
  ),

  -- ── Results (tests A/B/C + practices P1/P2/P3) ──
  'results_total', (
    select count(*) from app_results r
    where r.user_id <> (select id from app_users where username = 'smoketest.claude')
  ),
  'first_activity', (select min(created_at) from app_results),
  'last_activity',  (select max(created_at) from app_results),

  'by_type', (
    select coalesce(jsonb_object_agg(test_type, stats order by test_type), '{}'::jsonb)
    from (
      select test_type,
             jsonb_build_object(
               'attempts',     count(*),
               'users',        count(distinct user_id),
               'avg_score_pct', round(avg(100.0 * score / nullif(total, 0))),
               'pass_rate_pct', round(avg(case when passed then 100.0 else 0 end))
             ) as stats
      from app_results
      where user_id <> (select id from app_users where username = 'smoketest.claude')
      group by test_type
    ) t
  ),

  'active_users_by_day', (
    select coalesce(jsonb_object_agg(d, n order by d), '{}'::jsonb)
    from (
      select to_char(created_at::date, 'YYYY-MM-DD') as d,
             count(distinct user_id) as n
      from app_results
      where user_id <> (select id from app_users where username = 'smoketest.claude')
      group by 1
    ) t
  ),

  -- users who came back on 2+ different days (retention signal)
  'returning_users', (
    select count(*) from (
      select user_id from app_results
      where user_id <> (select id from app_users where username = 'smoketest.claude')
      group by user_id
      having count(distinct created_at::date) >= 2
    ) t
  ),

  -- ── Model accuracy (debug-mode confirmations, if any) ──
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
      'deepgram', round(avg(case when deepgram_vote = target_tone then 100.0 else 0 end))
    )
    from accuracy_log where user_correct is true
  )
);
$$;

grant execute on function public.app_analytics() to anon, authenticated;

-- Print the numbers right now:
select jsonb_pretty(app_analytics());
