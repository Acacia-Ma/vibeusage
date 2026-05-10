-- Remediate InsForge Backend Advisor performance findings.
-- Keep this file outside explicit transactions: CREATE INDEX CONCURRENTLY requires it.

create or replace function public.vibeusage_auth_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $function$
declare
  raw_claims text;
  subject text;
begin
  raw_claims := nullif(current_setting('request.jwt.claims', true), '');
  subject := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    case
      when raw_claims is null then null
      else raw_claims::jsonb ->> 'sub'
    end
  );

  if subject is null then
    return null;
  end if;

  begin
    return subject::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end
$function$;

grant execute on function public.vibeusage_auth_uid() to public;

create index concurrently if not exists idx_vibeusage_tracker_device_tokens_device_id
  on public.vibeusage_tracker_device_tokens(device_id);

create index concurrently if not exists idx_vibeusage_tracker_events_device_id
  on public.vibeusage_tracker_events(device_id);

create index concurrently if not exists idx_vibeusage_tracker_events_device_token_id
  on public.vibeusage_tracker_events(device_token_id);

create index concurrently if not exists idx_vibeusage_user_settings_user_id
  on public.vibeusage_user_settings(user_id);

create index concurrently if not exists idx_vibeusage_tracker_hourly_device_token_id
  on public.vibeusage_tracker_hourly(device_token_id);

create index concurrently if not exists idx_vibeusage_tracker_ingest_batches_device_token_id
  on public.vibeusage_tracker_ingest_batches(device_token_id);

create index concurrently if not exists idx_vibeusage_user_entitlements_user_id
  on public.vibeusage_user_entitlements(user_id);

create index concurrently if not exists idx_vibeusage_link_codes_user_id
  on public.vibeusage_link_codes(user_id);

create index concurrently if not exists idx_vibeusage_public_views_user_id
  on public.vibeusage_public_views(user_id);

create index concurrently if not exists idx_vibeusage_projects_device_id
  on public.vibeusage_projects(device_id);

create index concurrently if not exists idx_vibeusage_projects_device_token_id
  on public.vibeusage_projects(device_token_id);

create index concurrently if not exists idx_vibeusage_project_usage_hourly_device_id
  on public.vibeusage_project_usage_hourly(device_id);

create index concurrently if not exists idx_vibeusage_project_usage_hourly_device_token_id
  on public.vibeusage_project_usage_hourly(device_token_id);

create index concurrently if not exists idx_vibeusage_tracker_subscriptions_device_id
  on public.vibeusage_tracker_subscriptions(device_id);

create index concurrently if not exists idx_vibeusage_tracker_subscriptions_device_token_id
  on public.vibeusage_tracker_subscriptions(device_token_id);

alter policy vibeusage_link_codes_insert_self on public.vibeusage_link_codes
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_project_usage_hourly_select on public.vibeusage_project_usage_hourly
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_projects_select on public.vibeusage_projects
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_public_views_insert on public.vibeusage_public_views
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_public_views_select on public.vibeusage_public_views
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_public_views_update on public.vibeusage_public_views
  using ((select public.vibeusage_auth_uid()) = user_id)
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_device_tokens_insert on public.vibeusage_tracker_device_tokens
  with check (
    (select public.vibeusage_auth_uid()) = user_id
    and exists (
      select 1
      from public.vibeusage_tracker_devices d
      where d.id = device_id
        and d.user_id = (select public.vibeusage_auth_uid())
    )
  );

alter policy vibeusage_tracker_device_tokens_select on public.vibeusage_tracker_device_tokens
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_device_tokens_update on public.vibeusage_tracker_device_tokens
  using ((select public.vibeusage_auth_uid()) = user_id)
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_devices_insert on public.vibeusage_tracker_devices
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_devices_select on public.vibeusage_tracker_devices
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_devices_update on public.vibeusage_tracker_devices
  using ((select public.vibeusage_auth_uid()) = user_id)
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_events_select on public.vibeusage_tracker_events
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_hourly_select on public.vibeusage_tracker_hourly
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_tracker_subscriptions_select on public.vibeusage_tracker_subscriptions
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_user_entitlements_select on public.vibeusage_user_entitlements
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_user_settings_insert on public.vibeusage_user_settings
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_user_settings_select on public.vibeusage_user_settings
  using ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_user_settings_update on public.vibeusage_user_settings
  using ((select public.vibeusage_auth_uid()) = user_id)
  with check ((select public.vibeusage_auth_uid()) = user_id);
