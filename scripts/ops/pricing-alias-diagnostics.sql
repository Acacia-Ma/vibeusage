-- Pricing alias coverage diagnostics for OpenRouter-backed cost resolution.
-- Use this to understand how many recent usage models resolve directly, via alias,
-- or fall back to the default pricing profile.

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
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter'
    and active = true
),
alias_models as (
  select distinct lower(trim(usage_model)) as usage_model
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter'
    and active = true
),
classified as (
  select
    u.usage_model,
    u.row_count,
    u.total_tokens,
    u.billable_tokens,
    case
      when exists (
        select 1
        from pricing_models p
        where p.model = u.usage_model
           or p.model like '%/' || u.usage_model
           or u.usage_model like '%/' || p.model
      ) then 'direct'
      when exists (
        select 1
        from alias_models a
        where a.usage_model = u.usage_model
      ) then 'alias'
      else 'fallback'
    end as match_type
  from usage_models u
)
select match_type, count(*) as model_count
from classified
group by match_type
order by match_type;

-- Top unmatched models by recent billable volume.
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
pricing_models as (
  select distinct lower(trim(model)) as model
  from vibeusage_pricing_profiles
  where source = 'openrouter'
    and active = true
),
alias_models as (
  select distinct lower(trim(usage_model)) as usage_model
  from vibeusage_pricing_model_aliases
  where pricing_source = 'openrouter'
    and active = true
)
select
  u.usage_model,
  u.row_count,
  u.total_tokens,
  u.billable_tokens
from usage_models u
where not exists (
    select 1
    from pricing_models p
    where p.model = u.usage_model
       or p.model like '%/' || u.usage_model
       or u.usage_model like '%/' || p.model
  )
  and not exists (
    select 1
    from alias_models a
    where a.usage_model = u.usage_model
  )
order by u.billable_tokens desc, u.row_count desc, u.usage_model asc
limit 20;
