# Change: Add display_model to usage responses

## Why

Usage APIs currently expose canonical `model_id` and an existing `model` label, but dashboard consumers still show vendor-prefixed names such as `anthropic/claude-sonnet-4.6`. That is internal identity noise in the UI, not useful pricing information.

## What Changes

- Add a response-only `display_model` field to usage API model payloads.
- Keep `model_id` as the canonical internal key for pricing, filtering, and aggregation.
- Update dashboard model displays to prefer `display_model` without adding frontend model parsing logic.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: usage pricing shared core, usage response functions, dashboard model display helpers
