-- Pricing sync health check for OpenRouter rows.
-- Run in InsForge SQL console or via admin tooling.
--
-- Note:
-- `vibeusage-pricing-sync` upserts rows by (model, source, effective_from).
-- Re-running the sync on the same UTC day does not necessarily change created_at,
-- so freshness is derived from effective_from, not created_at.

-- 1) Effective-date freshness check.
select
  max(effective_from) as latest_effective_from,
  max(created_at) as last_created_at,
  (max(effective_from) >= current_date - interval '1 day') as is_fresh
from vibeusage_pricing_profiles
where source = 'openrouter';

-- 2) Active rows for the latest effective date.
with latest as (
  select max(effective_from) as effective_from
  from vibeusage_pricing_profiles
  where source = 'openrouter' and active = true
)
select effective_from, count(*) as active_rows
from vibeusage_pricing_profiles
where source = 'openrouter'
  and active = true
  and effective_from = (select effective_from from latest)
group by effective_from;

-- 3) Default model presence (exact or suffix match).
select model, source, effective_from, active, created_at
from vibeusage_pricing_profiles
where source = 'openrouter'
  and (model = 'gpt-5.2-codex' or model like '%/gpt-5.2-codex')
order by effective_from desc, created_at desc
limit 1;

-- 4) Coverage summary for recent usage models.
with usage_models as (
  select lower(trim(model)) as model
  from vibeusage_tracker_hourly
  where model is not null
    and trim(model) <> ''
    and lower(trim(model)) <> 'unknown'
    and hour_start >= now() - interval '30 days'
  group by 1
),
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter' and active = true
),
aliases as (
  select distinct lower(trim(usage_model)) as usage_model
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter' and active = true
),
matches as (
  select u.model as usage_model,
         exists (
           select 1
           from pricing_models p
           where p.model = u.model
              or p.model like '%' || '/' || u.model
              or u.model like '%' || '/' || p.model
         ) as has_pricing,
         exists (
           select 1
           from aliases a
           where a.usage_model = u.model
         ) as has_alias
  from usage_models u
)
select
  count(*) filter (where has_pricing) as direct_matches,
  count(*) filter (where not has_pricing and has_alias) as alias_matches,
  count(*) filter (where not has_pricing and not has_alias) as fallback_matches
from matches;

-- 5) Top unmatched usage models by recent billable volume.
with usage_models as (
  select
    lower(trim(model)) as model,
    count(*) as row_count,
    sum(coalesce(total_tokens, 0))::bigint as total_tokens,
    sum(coalesce(billable_total_tokens, coalesce(total_tokens, 0)))::bigint as billable_tokens
  from vibeusage_tracker_hourly
  where model is not null
    and trim(model) <> ''
    and lower(trim(model)) <> 'unknown'
    and hour_start >= now() - interval '30 days'
  group by 1
),
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter' and active = true
),
aliases as (
  select distinct lower(trim(usage_model)) as usage_model
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter' and active = true
)
select
  u.model as usage_model,
  u.row_count,
  u.total_tokens,
  u.billable_tokens
from usage_models u
where not exists (
    select 1
    from pricing_models p
    where p.model = u.model
       or p.model like '%/' || u.model
       or u.model like '%/' || p.model
  )
  and not exists (
    select 1
    from aliases a
    where a.usage_model = u.model
  )
order by u.billable_tokens desc, u.row_count desc, u.model asc
limit 20;
