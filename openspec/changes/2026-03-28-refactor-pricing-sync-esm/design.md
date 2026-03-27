## Context

`vibeusage-pricing-sync` now owns both price-profile synchronization and automatic high-confidence alias generation. The repository logic and local regression coverage are already correct, but the function remains authored under `insforge-src/functions/`, which still generates a CommonJS deploy artifact. Insforge2 currently rejects that artifact shape during Deno type checking, so production cannot receive the latest pricing-sync behavior.

## Goals / Non-Goals

- Goals:
  - Move `vibeusage-pricing-sync` onto `insforge-src/functions-esm/`
  - Preserve the current pricing-sync HTTP contract, auth gate, and alias-generation behavior
  - Ensure the generated deploy artifact no longer contains CommonJS wrappers
  - Verify a real live sync run succeeds after deployment
- Non-Goals:
  - Changing the pricing source, sync cadence, or alias confidence policy
  - Migrating unrelated legacy admin or ingest functions in the same slice

## Decisions

- Decision: migrate pricing-sync as a standalone ESM slice
  - Why: pricing sync is currently blocked by deploy-path failure, but its business logic is already stable and independently verified

- Decision: delete the legacy CommonJS source after creating the ESM entrypoint
  - Why: the build graph scans both trees, so dual author paths would violate the single-source-of-truth rule and break artifact generation

- Decision: keep helper logic local to the migrated pricing-sync entrypoint for this slice
  - Why: the immediate blocker is deployability, not shared pricing-sync extraction; wider helper refactors would expand scope without unlocking production faster

## Risks / Trade-offs

- The migration touches entrypoint loading and artifact assertions, so local tests must move to the ESM source instead of the old CommonJS file
- This slice solves deployability for pricing sync only; other legacy CJS functions remain a separate concern

## Verification

- `node --test test/pricing-sync-auto-alias.test.js`
- `node scripts/acceptance/openrouter-pricing-sync.cjs`
- `node --test test/insforge-esm-artifacts.test.js`
- `npm run build:insforge:check`
- `openspec validate 2026-03-28-refactor-pricing-sync-esm --strict`
