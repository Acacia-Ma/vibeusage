## Context

The merged SSOT work is already live for the ESM usage/leaderboard path, but a smaller legacy batch still depends on the CommonJS deploy pipeline:

- `vibeusage-debug-auth`
- `vibeusage-public-view-issue`
- `vibeusage-public-view-revoke`
- `vibeusage-public-view-status`
- `vibeusage-leaderboard-settings`

These handlers are thin wrappers around already-migrated shared logic, so keeping them on the legacy CJS path adds deployment risk without preserving any unique capability.

## Goals / Non-Goals

- Goals:
  - Move the thin legacy batch onto `insforge-src/functions-esm/`
  - Preserve existing slugs, methods, status codes, and response bodies
  - Ensure generated artifacts for the migrated slugs no longer contain `__commonJS`, `module.exports`, or `require(...)`
- Non-Goals:
  - Migrating the heavier legacy admin/ingest functions in the same slice
  - Changing endpoint semantics or adding compatibility fallbacks

## Decisions

- Decision: migrate the thin batch as a standalone slice before touching heavier legacy functions
  - Why: these handlers are low-coupling and immediately reduce production deploy risk

- Decision: delete the migrated CommonJS entry sources after creating their ESM counterparts
  - Why: duplicate entrypoints with the same slug would violate the single-source-of-truth rule and break the build graph

- Decision: keep the current shared ESM wrappers as the only imported dependencies
  - Why: the shared ESM path is already deployed and verified in production

## Risks / Trade-offs

- The build script currently scans both `insforge-src/functions/` and `insforge-src/functions-esm/`, so migration must be delete-and-replace rather than add-and-defer
- The thin batch reduces deploy-path risk but leaves heavier legacy functions for a later change

## Verification

- `node --test test/insforge-esm-artifacts.test.js`
- `node --test --test-name-pattern "vibeusage-debug-auth|vibeusage-public-view|vibeusage-leaderboard-settings" test/edge-functions.test.js`
- `npm run build:insforge`
- `npm run build:insforge:check`
- `openspec validate 2026-03-26-refactor-legacy-thin-functions-esm --strict`
