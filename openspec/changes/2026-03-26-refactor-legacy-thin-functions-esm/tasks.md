## 1. Implementation

- [x] 1.1 Add failing regression coverage for the thin legacy batch so the selected slugs must load from `insforge-src/functions-esm/` and emit non-CommonJS deploy artifacts.
- [x] 1.2 Migrate `vibeusage-debug-auth`, `vibeusage-public-view-issue`, `vibeusage-public-view-revoke`, `vibeusage-public-view-status`, and `vibeusage-leaderboard-settings` to `insforge-src/functions-esm/`.
- [x] 1.3 Remove the duplicate CommonJS entry sources for the migrated slugs and update the loader/build graph to point at the ESM sources.
- [x] 1.4 Rebuild `insforge-functions/` and refresh any affected docs/Canvas metadata.
- [x] 1.5 Deploy the migrated thin batch through Insforge and verify at least one real function response from the new path.

## 2. Verification

- [x] 2.1 `node --test test/insforge-esm-artifacts.test.js`
- [x] 2.2 `node --test --test-name-pattern "vibeusage-debug-auth|vibeusage-public-view|vibeusage-leaderboard-settings" test/edge-functions.test.js`
- [x] 2.3 `npm run build:insforge`
- [x] 2.4 `npm run build:insforge:check`
- [x] 2.5 `openspec validate 2026-03-26-refactor-legacy-thin-functions-esm --strict`
