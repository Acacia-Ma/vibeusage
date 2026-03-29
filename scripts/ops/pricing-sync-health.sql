-- Pricing sync health check for OpenRouter rows.
-- Run in InsForge SQL console or via admin tooling.
--
-- Note:
-- `vibeusage-pricing-sync` upserts pricing rows by (model, source, effective_from).
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

-- 4) Canonical + pricing coverage summary for recent usage models.
with usage_models as (
  select lower(trim(model)) as usage_model
  from vibeusage_tracker_hourly
  where model is not null
    and trim(model) <> ''
    and lower(trim(model)) <> 'unknown'
    and hour_start >= now() - interval '30 days'
  group by 1
),
model_alias_rows as (
  select
    lower(trim(usage_model)) as usage_model,
    lower(trim(canonical_model)) as canonical_model,
    effective_from,
    row_number() over (
      partition by lower(trim(usage_model))
      order by effective_from desc
    ) as rn
  from vibeusage_model_aliases
  where active = true
    and effective_from < current_date + interval '1 day'
),
model_aliases as (
  select usage_model, canonical_model
  from model_alias_rows
  where rn = 1
),
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter' and active = true
),
pricing_alias_rows as (
  select
    lower(trim(usage_model)) as usage_model,
    effective_from,
    row_number() over (
      partition by lower(trim(usage_model))
      order by effective_from desc
    ) as rn
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter'
    and active = true
    and effective_from <= current_date
),
pricing_aliases as (
  select usage_model
  from pricing_alias_rows
  where rn = 1
),
matches as (
  select
    u.usage_model,
    coalesce(m.canonical_model, u.usage_model) as canonical_model,
    (m.canonical_model is not null) as has_canonical_alias,
    exists (
      select 1
      from pricing_models p
      where p.model = coalesce(m.canonical_model, u.usage_model)
         or p.model like '%' || '/' || coalesce(m.canonical_model, u.usage_model)
         or coalesce(m.canonical_model, u.usage_model) like '%' || '/' || p.model
    ) as has_direct_pricing,
    exists (
      select 1
      from pricing_aliases a
      where a.usage_model = coalesce(m.canonical_model, u.usage_model)
    ) as has_pricing_alias
  from usage_models u
  left join model_aliases m on m.usage_model = u.usage_model
)
select
  count(*) filter (where has_canonical_alias) as canonical_alias_matches,
  count(*) filter (where not has_canonical_alias) as raw_passthrough_matches,
  count(*) filter (where has_direct_pricing) as direct_matches,
  count(*) filter (where not has_direct_pricing and has_pricing_alias) as alias_matches,
  count(*) filter (where not has_direct_pricing and not has_pricing_alias) as fallback_matches
from matches;

-- 5) Top raw usage models still missing canonical normalization.
with usage_models as (
  select
    lower(trim(model)) as usage_model,
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
model_alias_rows as (
  select
    lower(trim(usage_model)) as usage_model,
    effective_from,
    row_number() over (
      partition by lower(trim(usage_model))
      order by effective_from desc
    ) as rn
  from vibeusage_model_aliases
  where active = true
    and effective_from < current_date + interval '1 day'
),
model_aliases as (
  select usage_model
  from model_alias_rows
  where rn = 1
)
select
  u.usage_model,
  u.row_count,
  u.total_tokens,
  u.billable_tokens
from usage_models u
left join model_aliases m on m.usage_model = u.usage_model
where m.usage_model is null
order by u.billable_tokens desc, u.row_count desc, u.usage_model asc
limit 20;

-- 6) Top canonical models still missing pricing resolution.
with usage_models as (
  select
    lower(trim(model)) as usage_model,
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
model_alias_rows as (
  select
    lower(trim(usage_model)) as usage_model,
    lower(trim(canonical_model)) as canonical_model,
    effective_from,
    row_number() over (
      partition by lower(trim(usage_model))
      order by effective_from desc
    ) as rn
  from vibeusage_model_aliases
  where active = true
    and effective_from < current_date + interval '1 day'
),
model_aliases as (
  select usage_model, canonical_model
  from model_alias_rows
  where rn = 1
),
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter' and active = true
),
pricing_alias_rows as (
  select
    lower(trim(usage_model)) as usage_model,
    effective_from,
    row_number() over (
      partition by lower(trim(usage_model))
      order by effective_from desc
    ) as rn
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter'
    and active = true
    and effective_from <= current_date
),
pricing_aliases as (
  select usage_model
  from pricing_alias_rows
  where rn = 1
),
resolved as (
  select
    coalesce(m.canonical_model, u.usage_model) as canonical_model,
    sum(u.row_count)::bigint as row_count,
    sum(u.total_tokens)::bigint as total_tokens,
    sum(u.billable_tokens)::bigint as billable_tokens
  from usage_models u
  left join model_aliases m on m.usage_model = u.usage_model
  group by 1
)
select
  r.canonical_model,
  r.row_count,
  r.total_tokens,
  r.billable_tokens
from resolved r
where not exists (
    select 1
    from pricing_models p
    where p.model = r.canonical_model
       or p.model like '%/' || r.canonical_model
       or r.canonical_model like '%/' || p.model
  )
  and not exists (
    select 1
    from pricing_aliases a
    where a.usage_model = r.canonical_model
  )
order by r.billable_tokens desc, r.row_count desc, r.canonical_model asc
limit 20;
