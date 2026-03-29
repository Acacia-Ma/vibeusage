# Change: Migrate thin legacy edge functions onto the deployable ESM pipeline

## Why

The production rollout proved that Insforge currently accepts single-file ESM edge-function artifacts and rejects the legacy CommonJS bundle shape used by the remaining `insforge-src/functions/*` entrypoints. The smallest safe next slice is to migrate the thin diagnostic/retired/public-view handlers that still block a complete deployable path.

## What Changes

- Migrate the thin legacy function batch from `insforge-src/functions/` to `insforge-src/functions-esm/`
- Remove duplicate CommonJS entry sources for the migrated slugs so the build graph has one authoritative author path
- Extend deploy-artifact regression coverage so the migrated batch must build as ESM artifacts without CommonJS wrappers
- Update deployment notes/tasks to track the remaining legacy functions separately from this thin batch

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `insforge-src/functions/`
  - `insforge-src/functions-esm/`
  - `insforge-functions/`
  - `scripts/lib/load-edge-function.cjs`
  - `test/insforge-esm-artifacts.test.js`
  - `test/edge-functions.test.js`
