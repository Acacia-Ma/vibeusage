# Design: Canonical model sync before pricing aliases

## Overview

The runtime pricing path already consumes canonical `model_id` values from the model identity resolver. The remaining gap is background sync: pricing sync still scans raw usage models and writes pricing aliases directly. This change inserts a canonical alias generation stage before pricing alias generation without changing ingest or hourly schema.

## Decisions

- Keep `vibeusage_model_aliases` as the model identity source of truth.
- Keep `vibeusage_pricing_model_aliases` focused on canonical-model-to-pricing-model resolution.
- Do not add new columns to `vibeusage_tracker_hourly`.
- Do not create self-alias rows for models that are already canonical; raw fallback remains valid.
- Only write canonical aliases for deterministic patterns:
  - `qwen` with explicit version + tier (`plus`, `max`, `turbo`, `coder`, `coder-flash`, `coder-plus`, `coder-next`)
  - `deepseek` with explicit `r*`, `v*`, or `chat`
  - `glm` with explicit numeric version and optional `v`, `flash`, or `turbo`

## Sync flow

1. List recent raw usage models.
2. Load existing `vibeusage_model_aliases` rows for those raw models.
3. Generate and insert only new high-confidence canonical alias rows.
4. Resolve each raw usage model to a canonical model using existing + newly generated alias rows.
5. Generate pricing aliases from canonical models only.

## Non-goals

- No device-side normalization.
- No schema migration for usage tables.
- No automatic handling for ambiguous names such as `kimi-for-coding`, `gemini-3-pro`, or portal/custom suffix models.
