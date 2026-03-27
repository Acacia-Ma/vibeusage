## 1. Implementation

- [x] 1.1 Add failing regression coverage for canonical alias generation and canonical-first pricing alias generation.
- [x] 1.2 Update `vibeusage-pricing-sync` to generate high-confidence canonical aliases into `vibeusage_model_aliases`.
- [x] 1.3 Update pricing alias generation to consume canonical models instead of raw usage models.
- [x] 1.4 Split pricing diagnostics into raw/canonical/pricing coverage views and refresh ops docs.
- [x] 1.5 Rebuild InsForge artifacts and refresh coordination metadata.

## 2. Verification

- [x] 2.1 `node --test test/pricing-sync-auto-alias.test.js`
- [x] 2.2 `node scripts/acceptance/openrouter-pricing-sync.cjs`
- [x] 2.3 `node scripts/acceptance/pricing-model-alias.cjs`
- [x] 2.4 `node scripts/acceptance/pricing-resolver.cjs`
- [x] 2.5 `npm run build:insforge:check`
- [x] 2.6 `openspec validate 2026-03-28-refactor-model-identity-before-pricing --strict`
