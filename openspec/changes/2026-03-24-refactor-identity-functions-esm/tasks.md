## 1. Implementation

- [x] 1.1 Add an OpenSpec delta that codifies canonical identity precedence across dashboard and backend identity surfaces.
- [x] 1.2 Add failing regression coverage that proves the legacy CommonJS identity functions do not satisfy the deployable production path.
- [x] 1.3 Move `vibeusage-viewer-identity`, `vibeusage-public-view-profile`, and `vibeusage-leaderboard-refresh` to `insforge-src/functions-esm/` and migrate the shared identity resolver to `insforge-src/functions-esm/shared/`.
- [x] 1.4 Rebuild `insforge-functions/` and update any affected tests/docs.
- [x] 1.5 Deploy the migrated functions through Insforge2 and verify the deployed code matches the ESM path.

## 2. Verification

- [x] 2.1 `npm run build:insforge:check`
- [x] 2.2 `node --test test/edge-functions.test.js`
- [x] 2.3 `npm --prefix dashboard run typecheck`
- [x] 2.4 Read back the deployed Insforge2 functions and confirm `vibeusage-viewer-identity` exists while the updated public identity functions reflect the shared resolver
