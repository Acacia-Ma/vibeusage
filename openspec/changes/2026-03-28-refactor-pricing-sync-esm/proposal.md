# Change: Migrate pricing sync onto the deployable ESM pipeline

## Why

The pricing alias automation is correct locally, but production rollout is still blocked because `vibeusage-pricing-sync` lives on the legacy CommonJS deploy path. Insforge2 rejects that artifact shape during Deno type checking, so pricing-sync changes cannot reach production even when repository code and acceptance coverage are green.

## What Changes

- Migrate `vibeusage-pricing-sync` from `insforge-src/functions/` to `insforge-src/functions-esm/`
- Remove the duplicate CommonJS source so pricing sync has one authoritative author path
- Route local loaders and regression coverage through the migrated ESM source and artifact
- Verify the rebuilt pricing-sync artifact is deployable through the same ESM pipeline already used by live usage and identity functions

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `insforge-src/functions/`
  - `insforge-src/functions-esm/`
  - `insforge-functions/`
  - `scripts/lib/load-edge-function.cjs`
  - `scripts/acceptance/openrouter-pricing-sync.cjs`
  - `test/pricing-sync-auto-alias.test.js`
  - `test/insforge-esm-artifacts.test.js`
