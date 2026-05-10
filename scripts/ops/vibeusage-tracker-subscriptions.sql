-- Device subscription snapshot table for Identity_Core.
-- Stores the latest known paid-plan markers uploaded from local CLI clients.

create table if not exists public.vibeusage_tracker_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_id uuid not null references public.vibeusage_tracker_devices(id) on delete cascade,
  device_token_id uuid not null references public.vibeusage_tracker_device_tokens(id) on delete cascade,
  tool text not null,
  provider text not null,
  product text not null,
  plan_type text not null,
  rate_limit_tier text,
  active_start timestamptz,
  active_until timestamptz,
  last_checked timestamptz,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vibeusage_tracker_subscriptions_user_tool_provider_product_uniq
    unique (user_id, tool, provider, product)
);

create index if not exists vibeusage_tracker_subscriptions_user_id_idx
  on public.vibeusage_tracker_subscriptions(user_id);

create index if not exists vibeusage_tracker_subscriptions_updated_at_idx
  on public.vibeusage_tracker_subscriptions(updated_at desc);

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

alter table public.vibeusage_tracker_subscriptions enable row level security;

drop policy if exists project_admin_policy on public.vibeusage_tracker_subscriptions;
create policy project_admin_policy on public.vibeusage_tracker_subscriptions
  as permissive
  for all
  to project_admin
  using (true)
  with check (true);

drop policy if exists vibeusage_tracker_subscriptions_select on public.vibeusage_tracker_subscriptions;
create policy vibeusage_tracker_subscriptions_select on public.vibeusage_tracker_subscriptions
  for select
  to public
  using ((select public.vibeusage_auth_uid()) = user_id);
