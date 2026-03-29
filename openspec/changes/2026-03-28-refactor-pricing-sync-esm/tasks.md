## 1. Implementation

- [x] 1.1 Add regression coverage that requires `vibeusage-pricing-sync` to load from `insforge-src/functions-esm/` and emit a non-CommonJS deploy artifact.
- [x] 1.2 Migrate `vibeusage-pricing-sync` to `insforge-src/functions-esm/` and keep the current pricing alias behavior intact.
- [x] 1.3 Remove the duplicate CommonJS source entry and update the loader/build graph to the ESM source of truth.
- [x] 1.4 Rebuild `insforge-functions/` and refresh any affected docs/coordination metadata.
- [x] 1.5 Deploy the migrated pricing-sync function through Insforge2 and verify a real production sync run from GitHub Actions.

## 2. Verification

- [x] 2.1 `node --test test/pricing-sync-auto-alias.test.js`
- [x] 2.2 `node scripts/acceptance/openrouter-pricing-sync.cjs`
- [x] 2.3 `node --test test/insforge-esm-artifacts.test.js`
- [x] 2.4 `npm run build:insforge:check`
- [x] 2.5 `openspec validate 2026-03-28-refactor-pricing-sync-esm --strict`
