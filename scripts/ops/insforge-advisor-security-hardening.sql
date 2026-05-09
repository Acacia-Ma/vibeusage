-- Remediate InsForge Backend Advisor RLS and SECURITY DEFINER findings.
-- Run against the InsForge Postgres database after reviewing the access notes below.
--
-- Access boundaries:
-- - NFT and legacy public tables become default-deny through RLS.
-- - Pricing/model metadata remains readable only by authenticated users.
-- - project_admin remains a privileged DB role, but policies no longer use literal true.
-- - SECURITY DEFINER functions stay privileged where required by ingest/link/leaderboard flows.

begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nft_siwe_nonces',
    'nft_wallet_bindings',
    'nft_wallet_binding_audit',
    'nft_issuances',
    'nft_allowlist_roots',
    'vibeusage_user_totals',
    'posts'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.vibeusage_model_aliases') is not null then
    drop policy if exists vibeusage_model_aliases_select on public.vibeusage_model_aliases;
    create policy vibeusage_model_aliases_select on public.vibeusage_model_aliases
      for select
      to authenticated
      using ((select auth.uid()) is not null);
  end if;

  if to_regclass('public.vibeusage_pricing_model_aliases') is not null then
    drop policy if exists vibeusage_pricing_model_aliases_select on public.vibeusage_pricing_model_aliases;
    create policy vibeusage_pricing_model_aliases_select on public.vibeusage_pricing_model_aliases
      for select
      to authenticated
      using ((select auth.uid()) is not null);
  end if;

  if to_regclass('public.vibeusage_pricing_profiles') is not null then
    drop policy if exists vibeusage_pricing_profiles_select on public.vibeusage_pricing_profiles;
    create policy vibeusage_pricing_profiles_select on public.vibeusage_pricing_profiles
      for select
      to authenticated
      using ((select auth.uid()) is not null);
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'nft_siwe_nonces',
    'nft_wallet_bindings',
    'nft_wallet_binding_audit',
    'nft_issuances',
    'nft_allowlist_roots',
    'vibeusage_user_totals',
    'posts',
    'vibeusage_projects',
    'vibeusage_public_views',
    'vibeusage_tracker_device_tokens',
    'vibeusage_tracker_devices',
    'vibeusage_tracker_events',
    'vibeusage_tracker_hourly',
    'vibeusage_tracker_ingest_batches',
    'vibeusage_leaderboard_snapshots',
    'vibeusage_link_codes',
    'vibeusage_model_aliases',
    'vibeusage_tracker_subscriptions',
    'vibeusage_pricing_model_aliases',
    'vibeusage_user_entitlements',
    'vibeusage_pricing_profiles',
    'vibeusage_user_settings'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('drop policy if exists project_admin_policy on public.%I', table_name);
      execute format(
        'create policy project_admin_policy on public.%I for all to project_admin using (current_user = %L) with check (current_user = %L)',
        table_name,
        'project_admin',
        'project_admin'
      );
    end if;
  end loop;

  if to_regclass('public.vibeusage_project_usage_hourly') is not null then
    drop policy if exists project_admin_usage_policy on public.vibeusage_project_usage_hourly;
    drop policy if exists project_admin_policy on public.vibeusage_project_usage_hourly;
    create policy project_admin_policy on public.vibeusage_project_usage_hourly
      for all
      to project_admin
      using (current_user = 'project_admin')
      with check (current_user = 'project_admin');
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.vibeusage_device_token_allows_event_insert(uuid,uuid,uuid)') is not null then
    revoke execute on function public.vibeusage_device_token_allows_event_insert(uuid, uuid, uuid) from public;
    grant execute on function public.vibeusage_device_token_allows_event_insert(uuid, uuid, uuid) to anon, authenticated, project_admin;
    alter function public.vibeusage_device_token_allows_event_insert(uuid, uuid, uuid) set search_path = '';
  end if;

  if to_regprocedure('public.vibeusage_leaderboard_system_earliest_day()') is not null then
    revoke execute on function public.vibeusage_leaderboard_system_earliest_day() from public;
    grant execute on function public.vibeusage_leaderboard_system_earliest_day() to authenticated, project_admin;
    alter function public.vibeusage_leaderboard_system_earliest_day() set search_path = '';
  end if;

  if to_regprocedure('public.vibeusage_purge_events(timestamp with time zone,boolean)') is not null then
    revoke execute on function public.vibeusage_purge_events(timestamp with time zone, boolean) from public;
    grant execute on function public.vibeusage_purge_events(timestamp with time zone, boolean) to project_admin;
    alter function public.vibeusage_purge_events(timestamp with time zone, boolean) set search_path = '';
  end if;

  if to_regprocedure('public.vibeusage_exchange_link_code(text,text,text,text,text)') is not null then
    revoke execute on function public.vibeusage_exchange_link_code(text, text, text, text, text) from public;
    grant execute on function public.vibeusage_exchange_link_code(text, text, text, text, text) to anon, authenticated, project_admin;
    alter function public.vibeusage_exchange_link_code(text, text, text, text, text) set search_path = '';
  end if;

  if to_regprocedure('public.vibeusage_leaderboard_period(text,text,integer)') is not null then
    revoke execute on function public.vibeusage_leaderboard_period(text, text, integer) from public;
    grant execute on function public.vibeusage_leaderboard_period(text, text, integer) to authenticated, project_admin;
    alter function public.vibeusage_leaderboard_period(text, text, integer) set search_path = '';
  end if;

  if to_regprocedure('public.vibeusage_leaderboard_me(text,text)') is not null then
    revoke execute on function public.vibeusage_leaderboard_me(text, text) from public;
    grant execute on function public.vibeusage_leaderboard_me(text, text) to authenticated, project_admin;
    alter function public.vibeusage_leaderboard_me(text, text) set search_path = '';
  end if;
end $$;

commit;

-- Verification queries:
--
-- select c.relname, c.relrowsecurity, c.relforcerowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'nft_siwe_nonces',
--     'nft_wallet_bindings',
--     'nft_wallet_binding_audit',
--     'nft_issuances',
--     'nft_allowlist_roots',
--     'vibeusage_user_totals',
--     'posts'
--   )
-- order by c.relname;
--
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and (
--     policyname in (
--       'vibeusage_model_aliases_select',
--       'vibeusage_pricing_model_aliases_select',
--       'vibeusage_pricing_profiles_select',
--       'project_admin_policy',
--       'project_admin_usage_policy'
--     )
--     or tablename like 'vibeusage_%'
--   )
-- order by tablename, policyname;
--
-- select n.nspname, p.proname, pg_get_function_arguments(p.oid) as arguments, p.prosecdef, p.proconfig
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in (
--     'vibeusage_device_token_allows_event_insert',
--     'vibeusage_leaderboard_system_earliest_day',
--     'vibeusage_purge_events',
--     'vibeusage_exchange_link_code',
--     'vibeusage_leaderboard_period',
--     'vibeusage_leaderboard_me'
--   )
-- order by p.proname;
