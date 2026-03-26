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
- [x] 4.2.21 Converge summary rolling-window usage aggregation through `usage-pricing-core` while keeping time-range orchestration in the endpoint.
- [x] 4.2.22 Converge raw hourly row normalization through `usage-row-core` while keeping endpoint-specific timestamp fallback explicit.
- [x] 4.2.23 Converge heatmap payload assembly through `usage-heatmap-core` while keeping time-window/query orchestration in the endpoint.
- [x] 4.2.24 Converge model-breakdown source/model aggregation and totals formatting through `usage-pricing-core` while keeping alias resolution and bucket assembly in the endpoint.
- [x] 4.2.25 Converge aggregate summary payload assembly through `usage-pricing-core` for `usage-summary` and `usage-daily`.
- [x] 4.2.26 Converge hourly bucket assembly through `usage-hourly-core` while keeping query/sync orchestration in the endpoint.
- [x] 4.2.27 Converge ISO normalization and sync interval timing through `date-core` across ESM/CJS runtime consumers.
- [x] 4.2.28 Converge usage token bucket payload formatting through `usage-metrics-core` across hourly/daily/monthly and pricing payload consumers.
- [x] 4.2.29 Converge heatmap request normalization and per-day accumulation through `usage-heatmap-core` while keeping time-window/query orchestration in the endpoint.
- [x] 4.2.30 Converge local usage date-range request resolution through `date-core` for summary/daily/model-breakdown endpoints.
- [x] 4.2.31 Converge project-usage summary limit normalization, aggregate fallback detection, row normalization, and fallback aggregation through `project-usage-core`.
- [x] 4.2.32 Converge summary/daily aggregate hourly range collection through `usage-aggregate-collector-core` while keeping pricing state in `usage-pricing-core` and endpoint-specific sinks in the endpoints.
- [x] 4.2.33 Converge summary/daily aggregate pricing payload resolution through `usage-pricing-core` while keeping endpoint envelope shapes explicit.
- [x] 4.2.34 Converge usage/project summary debug-aware JSON response assembly through `usage-response-core` while keeping endpoint payload envelopes explicit.
- [x] 4.2.35 Converge hourly/heatmap/model-breakdown normalized hourly row collection through `usage-row-collector-core` while keeping endpoint accumulators explicit.
- [x] 4.2.36 Converge summary/daily aggregate request context through `usage-aggregate-request-core` while keeping auth handling and endpoint envelopes explicit.
- [x] 4.2.37 Converge monthly/hourly/heatmap source-model request parsing and filter context through `usage-filter-request-core` while keeping endpoint time windows explicit.
- [x] 4.2.38 Converge source/local-range request parsing for model-breakdown and aggregate request contexts through `usage-range-request-core` while keeping auth handling and endpoint envelopes explicit.
- [x] 4.2.39 Converge heatmap request-window resolution through `usage-heatmap-core` while keeping auth and row collection explicit.
- [x] 4.2.40 Converge project-usage aggregate/fallback query construction through `project-usage-core` while keeping endpoint envelope and fallback branching explicit.
- [x] 4.2.41 Converge hourly usage day-window and row-slot normalization through `usage-hourly-core` while keeping UTC aggregate fast-path explicit.
- [x] 4.2.42 Converge usage filter request snapshots through `usage-filter-request-core` while keeping endpoint-specific windows and payloads explicit.
- [x] 4.2.43 Converge usage/project endpoint preflight handling through `functions-esm/shared/core/usage-endpoint.js` while keeping auth timing and endpoint-specific request ordering explicit.
- [x] 4.2.44 Converge hourly detail and aggregate select contracts through `usage-hourly-query-core` while keeping endpoint-specific collectors and envelopes explicit.

## 5. Verification

- [x] 5.1 `openspec validate 2026-03-24-refactor-ssot-foundations --strict`
- [x] 5.2 `node --test test/model-breakdown.test.js test/runtime-config.test.js test/dashboard-session-expired-banner.test.js test/insforge-esm-artifacts.test.js`
- [x] 5.3 `npm --prefix dashboard run test`
- [x] 5.4 `npm --prefix dashboard run typecheck`
- [x] 5.5 `npm run validate:copy`
