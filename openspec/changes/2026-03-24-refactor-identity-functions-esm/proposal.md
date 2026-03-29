# Change: Refactor identity functions onto the deployable ESM pipeline

## Why

The merged viewer-identity fix did not reach production because the new and updated identity edge functions still lived on the legacy CommonJS deployment path. Insforge2 now rejects those generated CommonJS artifacts during Deno type checking, so the dashboard falls back to `ANONYMOUS` even though the repository code is correct.

## What Changes

- Migrate `vibeusage-viewer-identity`, `vibeusage-public-view-profile`, and `vibeusage-leaderboard-refresh` from `insforge-src/functions/` to `insforge-src/functions-esm/`
- Move the shared user-identity resolver onto `insforge-src/functions-esm/shared/` so all identity surfaces use the same deployable source
- Rebuild `insforge-functions/`, add regression coverage, and deploy the updated functions through the working ESM artifact path
- Update deployment notes so identity functions no longer rely on the legacy CommonJS deploy path

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `insforge-src/functions/`
  - `insforge-src/functions-esm/`
  - `insforge-functions/`
  - `dashboard/src/lib/current-identity.ts`
  - `dashboard/src/lib/vibeusage-api.ts`
  - `test/edge-functions.test.js`
  - `BACKEND_API.md`
