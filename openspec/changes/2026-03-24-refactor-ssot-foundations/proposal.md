# Change: Refactor SSOT foundations across backend, dashboard, and scripts

## Why

Core contracts currently drift across duplicated helpers, shadow state stores, and hardcoded defaults. This blocks safe refactors because multiple modules can disagree about auth/session, model identity, copy parsing, cache semantics, and runtime targets.

## What Changes

- Establish one umbrella SSOT change for cross-module refactor work.
- Designate exactly one authoritative source for each core domain and document all derived readers.
- Remove dashboard shadow auth storage so InsForge session persistence is the only auth/session source.
- Move copy registry parsing, runtime defaults, and function slug contracts to shared modules consumed by dashboard and Node tooling.
- Converge dashboard model aggregation on canonical `model_id`.
- Add guardrails and regression checks for future SSOT drift.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `dashboard/`, `src/`, `scripts/`, `insforge-src/`
- Input changes consolidated here:
  - `2026-01-23-refactor-frontend-foundation`
  - `2026-01-25-refactor-backend-core`
