## Context

The dashboard identity panel now calls `vibeusage-viewer-identity`, but production still shows `ANONYMOUS` because the function was never deployed. The attempted deploy failed before runtime because the legacy CommonJS artifacts generated from `insforge-src/functions/` no longer pass Insforge2's Deno type check.

At the same time, `vibeusage-public-view-profile` and `vibeusage-leaderboard-refresh` were updated in the repository to use the same identity precedence, but those updates also never reached production for the same deployment reason.

## Goals / Non-Goals

- Goals:
  - Move the affected identity functions onto the deployable Deno/ESM pipeline
  - Preserve one canonical display-name precedence across dashboard, public profile, and leaderboard refresh
  - Verify the new functions can be built, deployed, and read back from Insforge2
- Non-Goals:
  - Reverting the dashboard to session- or redirect-derived identity fields
  - Introducing fallback compatibility paths between old and new identity sources
  - Refactoring unrelated edge functions off the legacy path in the same change

## Decisions

- Decision: identity edge functions will live under `insforge-src/functions-esm/`
  - Why: current Insforge2 deployment accepts the ESM artifacts already used by `vibeusage-usage-summary`; it rejects the legacy CommonJS artifacts for these functions
  - Alternatives considered:
    - Keep using `insforge-src/functions/` and patch the generated CommonJS artifact: rejected because it preserves a broken deployment path and duplicates logic
    - Revert the dashboard to a different identity source: rejected because it breaks the single-source-of-truth model

- Decision: the shared identity resolver moves to `insforge-src/functions-esm/shared/user-identity.js`
  - Why: public profile, viewer identity, and leaderboard refresh must share one deployable resolver

- Decision: the frontend contract remains unchanged
  - Why: the dashboard should continue calling `getViewerIdentity()`; the fix is to make the backend path deployable, not to add another frontend fallback

## Risks / Trade-offs

- Migrating only three functions leaves other legacy CommonJS functions in place, but it restores the broken production path without broadening scope
- ESM migration requires touching shared auth/http/logging imports; regressions are contained by targeted edge-function tests and deployment read-back checks

## Verification

- Local red/green tests for the migrated functions and build artifacts
- `npm run build:insforge:check`
- `node --test test/edge-functions.test.js`
- `npm --prefix dashboard run typecheck`
- Insforge2 deploy/read-back verification for:
  - `vibeusage-viewer-identity`
  - `vibeusage-public-view-profile`
  - `vibeusage-leaderboard-refresh`
