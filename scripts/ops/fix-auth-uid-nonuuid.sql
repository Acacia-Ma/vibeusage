-- Fix VibeUsage RLS policies for InsForge API-key requests whose JWT sub is
-- not a UUID.
--
-- Root cause:
--   auth.uid() is InsForge-managed and casts JWT sub directly to uuid. Project
--   API-key requests can carry sub = 'project-admin-with-api-key', so any RLS
--   policy that evaluates auth.uid() fails before other permissive policies can
--   authorize service/device-token paths.
--
-- Contract:
--   - UUID sub values still compare exactly against user_id.
--   - Missing or non-UUID sub values return null.
--   - Existing user policies remain default-deny for non-user service/API-key
--     subjects instead of raising a cast error.

begin;

create or replace function public.vibeusage_auth_uid()
returns uuid
language sql
stable
set search_path = ''
as $function$
  with claims as (
    select
      nullif(current_setting('request.jwt.claim.sub', true), '') as legacy_sub,
      nullif(current_setting('request.jwt.claims', true), '') as claims_json
  ),
  subject as (
    select coalesce(
      legacy_sub,
      case
        when claims_json is null then null
        else claims_json::jsonb ->> 'sub'
      end
    ) as sub
    from claims
  )
  select case
    when sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then sub::uuid
    else null
  end
  from subject
$function$;

grant execute on function public.vibeusage_auth_uid() to public;

alter policy vibeusage_link_codes_insert_self on public.vibeusage_link_codes
  with check ((select public.vibeusage_auth_uid()) = user_id);

alter policy vibeusage_model_aliases_select on public.vibeusage_model_aliases
  using (current_user = 'authenticated');

alter policy vibeusage_pricing_model_aliases_select on public.vibeusage_pricing_model_aliases
  using (current_user = 'authenticated');

alter policy vibeusage_pricing_profiles_select on public.vibeusage_pricing_profiles
  using (current_user = 'authenticated');

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
    ((select public.vibeusage_auth_uid()) = user_id)
    and exists (
      select 1
      from public.vibeusage_tracker_devices d
      where d.id = vibeusage_tracker_device_tokens.device_id
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

commit;
