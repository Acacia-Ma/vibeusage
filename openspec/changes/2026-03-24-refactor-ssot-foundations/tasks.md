## 1. Baseline

- [x] 1.1 Regenerate Canvas before implementation and after verification.
- [x] 1.2 Validate this umbrella change and use it as the only SSOT refactor tracker.
- [x] 1.3 Record the core domain matrix and strict-cutover rules.

## 2. Shared contracts

- [x] 2.1 Extract shared copy registry parser and reuse it in dashboard runtime, validator, and Vite meta injection.
- [x] 2.2 Extract shared runtime defaults and reuse them in CLI, dashboard, and selected smoke/acceptance scripts.
- [x] 2.3 Extract shared function slug contract and reuse it in dashboard and CLI API clients.

## 3. Dashboard state convergence

- [x] 3.1 Remove `vibeusage.dashboard.auth.v1` as a state source.
- [x] 3.2 Keep only UI expiry markers in `auth-storage.ts`.
- [x] 3.3 Ensure `CurrentIdentity` derives from viewer identity endpoint data.
- [x] 3.4 Move usage/trend/heatmap/model-breakdown cache reads/writes to a shared cache helper.
- [x] 3.5 Aggregate top models by canonical `model_id`.

## 4. Backend convergence

- [x] 4.1 Add backend SSOT guardrails for duplicated shared semantics.
- [ ] 4.2 Continue migrating ESM shared business rules behind canonical backend modules without changing public slugs.
- [x] 4.2.1 Converge model normalization, identity, and alias timeline semantics through `insforge-src/shared/usage-model-core.js` with a mirrored ESM artifact.
- [x] 4.2.2 Converge pricing and usage metric helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.3 Converge runtime/env/source/number helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.4 Converge auth/public-view/public-visibility semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.5 Converge pro-status/http helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.6 Converge canary/debug/crypto helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.7 Converge date/logging helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.8 Converge pagination/rollup/daily-filter-monthly helper semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.9 Converge leaderboard/user-identity normalization semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.10 Converge usage summary/daily bucketed pricing semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.11 Converge usage model breakdown bucket-cost attribution semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.12 Converge alias-timeline canonical-model row matching semantics for hourly/heatmap queries through shared backend cores.
- [x] 4.2.13 Converge summary/monthly row-level canonical-model filtering through `usage-filter` shared backend cores.
- [x] 4.2.14 Converge raw hourly usage query construction semantics through shared backend cores with mirrored ESM artifacts.
- [x] 4.2.15 Converge request-time usage model filter context resolution through `usage-model-core` and shared ESM support exports.
- [x] 4.2.16 Converge aggregate summary/daily pricing resolution through `usage-pricing-core` and shared ESM consumers.
- [x] 4.2.17 Converge summary/daily runtime aggregation onto the hourly-only path while rollup remains explicitly disabled in shared core.
- [x] 4.2.18 Converge usage-model alias timeline resolution through `usage-model-core` for pricing and model-breakdown consumers.
- [x] 4.2.19 Converge hourly usage row pagination/orchestration through `usage-hourly-query-core` and shared db wrappers.
- [x] 4.2.20 Converge summary/daily aggregate usage ingest state through `usage-pricing-core` and shared ESM consumers.

## 5. Verification

- [x] 5.1 `openspec validate 2026-03-24-refactor-ssot-foundations --strict`
- [x] 5.2 `node --test test/model-breakdown.test.js test/runtime-config.test.js test/dashboard-session-expired-banner.test.js test/insforge-esm-artifacts.test.js`
- [x] 5.3 `npm --prefix dashboard run test`
- [x] 5.4 `npm --prefix dashboard run typecheck`
- [x] 5.5 `npm run validate:copy`
