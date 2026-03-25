# Design: SSOT foundations

## Domain matrix

| Domain | Authoritative source | Derived layers | Readers |
| --- | --- | --- | --- |
| `auth/session` | InsForge persistent session storage (`dashboard/src/lib/insforge-client.ts`) | soft/session-expired UI markers only | `App.jsx`, auth hooks, API retry flow |
| `viewer identity` | `vibeusage-viewer-identity` endpoint | nullable UI placeholder state | `current-identity.ts`, `DashboardPage.jsx` |
| `model identity` | backend canonical `model_id` contract | display labels, charts, pricing labels | usage summary/model breakdown/dashboard panels |
| `copy registry` | `dashboard/src/content/copy.csv` + shared parser | runtime map, validator report, Vite meta injection | `copy.ts`, `validate-copy-registry.cjs`, `vite.config.js` |
| `runtime defaults` | shared runtime defaults module | CLI config resolution, dashboard config, smoke scripts | `runtime-config.js`, `config.ts`, ops/acceptance scripts |
| `function slugs` | shared function contract module | dashboard API client, CLI API client | `dashboard/src/lib/vibeusage-api.ts`, `src/lib/vibeusage-api.js` |
| `dashboard cache` | shared dashboard cache protocol | hook-local view models only | usage/trend/heatmap/model-breakdown hooks |
| `usage aggregate` | PostgreSQL + backend aggregation | frontend rendering only | usage summary/daily/breakdown/heatmap consumers |

## Strict cutover rules

1. No new compatibility store for auth/session.
2. `model_id` is canonical machine identity. `model` remains display label only.
3. Local cache is provenance-tagged derived data only and must never redefine server truth.
4. Shared parser/default/slug modules are the only place allowed to define those contracts.

## Backend convergence note

Model normalization, canonical identity resolution, and alias timeline rules now converge through `insforge-src/shared/usage-model-core.js`. The ESM layer consumes a mirrored `.mjs` artifact whose contents are guardrailed to stay byte-for-byte identical, while CJS and ESM wrappers remain thin export layers only.

Pricing resolution, cost computation, billable-total resolution, shared totals helpers, and pricing bucket key parsing now follow the same pattern through `insforge-src/shared/pricing-core.js` and `insforge-src/shared/usage-metrics-core.js`, again with mirrored `.mjs` artifacts for the ESM edge layer.

Runtime env parsing, request base URL resolution, numeric coercion, and source normalization now converge through `insforge-src/shared/env-core.js` and `insforge-src/shared/runtime-primitives-core.js`. CJS and ESM wrappers for `env`, `date`, `logging`, `numbers`, and `source` now consume those cores instead of carrying separate helper implementations.

JWT parsing, HS256 verification, bearer-to-user resolution, and public access-context rules now converge through `insforge-src/shared/auth-core.js`. Public share token normalization, public profile resolution, and public visibility state transitions now converge through `insforge-src/shared/public-sharing-core.js`. CJS and ESM wrappers for `auth`, `public-view`, and `public-visibility` now provide only environment/client hashing adapters on top of those cores.

Registration-cutoff and entitlement-based pro status resolution now converge through `insforge-src/shared/pro-status-core.js`. Shared HTTP response helpers (`corsHeaders`, `handleOptions`, `json`, `requireMethod`, `readJson`) now converge through `insforge-src/shared/http-core.js`. CJS and ESM wrappers for `pro-status` and `http` are now thin export layers over those cores.

Canary model filtering, slow-query debug payload construction, and SHA-256 hashing semantics now converge through `insforge-src/shared/canary-core.js`, `insforge-src/shared/debug-core.js`, and `insforge-src/shared/crypto-core.js`. CJS and ESM wrappers for `canary`, `debug`, and `crypto` are now thin export layers over those cores, and nullish hashing inputs are normalized identically across both runtimes.

UTC/local date-window normalization, timezone parsing, local date-key formatting, and usage max-days lookup now converge through `insforge-src/shared/date-core.js`. Request-id generation, function-name resolution, request/upstream logging, and slow-query threshold handling now converge through `insforge-src/shared/logging-core.js`. CJS and ESM wrappers for `date` and `logging` now provide only export-surface adaptation on top of those cores.

Shared pagination, rollup row fetching, daily bucket accumulation, canonical-model row filtering, and monthly bucket accumulation now converge through `insforge-src/shared/pagination-core.js`, `insforge-src/shared/usage-rollup-core.js`, `insforge-src/shared/usage-daily-core.js`, `insforge-src/shared/usage-filter-core.js`, and `insforge-src/shared/usage-monthly-core.js`. CJS wrappers in `shared/pagination.js`, `shared/usage-rollup.js`, and `shared/core/*` plus the ESM `usage-summary-support.js` and `shared/core/*` modules now delegate to those shared cores instead of carrying duplicate algorithms.

Shared user identity sanitization now converges through `insforge-src/shared/user-identity-core.js`, and leaderboard period/window math, snapshot token derivation, generated-at normalization, and public display/avatar normalization now converge through `insforge-src/shared/leaderboard-core.js`. CJS `vibeusage-leaderboard-refresh`, `vibeusage-leaderboard-profile`, `shared/user-identity.js`, and the ESM `vibeusage-leaderboard` function now consume those cores instead of keeping separate normalization paths.

Bucketed pricing resolution for aggregate usage endpoints now converges through `insforge-src/shared/usage-pricing-core.js`. The ESM `vibeusage-usage-summary`, `vibeusage-usage-daily`, and `vibeusage-usage-model-breakdown` functions now reuse the same alias-timeline pricing resolution, implied-model selection, and summary pricing-mode logic instead of maintaining duplicated cost-aggregation flows. `vibeusage-usage-model-breakdown` now attributes per-bucket costs back into source/model aggregates via the shared pricing core callback path, and `vibeusage-usage-summary` also now uses the shared source-parameter parser instead of a local duplicate.

Alias-timeline canonical-model matching for range-filtered usage queries now converges through `insforge-src/shared/usage-model-core.js`. The ESM `vibeusage-usage-hourly` and `vibeusage-usage-heatmap` functions now delegate their per-row canonical-model inclusion checks to the shared `matchesCanonicalModelAtDate` helper instead of carrying four inline copies of the same identity-comparison rule across UTC and local-time paths.

Row-level canonical-model filtering for aggregate usage endpoints now converges through `insforge-src/shared/usage-filter-core.js`. The shared `usage-monthly-core` and the ESM `vibeusage-usage-summary` function now reuse `shouldIncludeUsageRow` instead of each re-implementing `resolveIdentityAtDate` comparisons, which keeps alias-timeline effective-date filtering aligned across daily, monthly, and summary aggregation paths.

Raw hourly usage query construction now converges through `insforge-src/shared/usage-hourly-query-core.js`. The existing CJS `shared/db/usage-hourly.js` builder is now just a wrapper over that core, and ESM usage endpoints (`vibeusage-usage-summary`, `vibeusage-usage-daily`, `vibeusage-usage-monthly`, `vibeusage-usage-hourly`, `vibeusage-usage-heatmap`, and `vibeusage-usage-model-breakdown`) now all reuse the same `buildHourlyUsageQuery` helper for `vibeusage_tracker_hourly` reads instead of carrying duplicate `source/model/canary/range/order` query assembly logic in each function.

Request-time usage model filter context resolution now also converges through `insforge-src/shared/usage-model-core.js`. The shared `resolveUsageFilterContext` helper is exported through `functions-esm/shared/usage-summary-support.js`, and the ESM `vibeusage-usage-summary`, `vibeusage-usage-daily`, `vibeusage-usage-monthly`, `vibeusage-usage-hourly`, and `vibeusage-usage-heatmap` functions now all reuse that single `canonicalModel/usageModels/hasModelFilter/aliasTimeline` assembly path instead of repeating the same `resolveUsageModelsForCanonical + fetchAliasRows + buildAliasTimeline` orchestration block in each endpoint.

Aggregate pricing resolution for `vibeusage-usage-summary` and `vibeusage-usage-daily` now also converges through `insforge-src/shared/usage-pricing-core.js`. The shared `resolveAggregateUsagePricing` helper owns the repeated `identityMap/canonicalModels/impliedModelId/pricingProfile/summaryPricingMode/totalCostMicros` decision flow, so those ESM endpoints no longer carry separate copies of the same post-aggregation pricing logic.

Runtime aggregation selection for `vibeusage-usage-summary` and `vibeusage-usage-daily` now also converges onto the hourly-only path that is already enforced by `insforge-src/shared/usage-rollup-core.js`. The ESM `usage-summary-support` module no longer re-exports rollup helpers, and the `vibeusage-usage-summary` and `vibeusage-usage-daily` functions no longer carry dead `rollup flag / rollup fallback / split-range rollup` orchestration branches. Current production behavior is therefore expressed in exactly one place: rollup remains disabled in shared core, while the live endpoints always aggregate from hourly rows.

Alias-timeline resolution for usage-model sets now also converges through `insforge-src/shared/usage-model-core.js`. The new shared `resolveUsageTimelineContext` helper owns the repeated `normalize usageModels -> fetchAliasRows -> buildAliasTimeline` chain, so `resolveUsageFilterContext`, `insforge-src/shared/usage-pricing-core.js`, and the ESM `vibeusage-usage-model-breakdown` function no longer maintain separate copies of the same model-alias timeline assembly logic.

Hourly usage row pagination/orchestration now also converges through `insforge-src/shared/usage-hourly-query-core.js`. The shared `forEachHourlyUsagePage` helper owns the repeated `buildHourlyUsageQuery + forEachPage + normalized pageRows + rowCount` scan layer, so ESM usage endpoints (`vibeusage-usage-summary`, `vibeusage-usage-daily`, `vibeusage-usage-monthly`, `vibeusage-usage-hourly`, `vibeusage-usage-heatmap`, and `vibeusage-usage-model-breakdown`) no longer each carry their own copy of the hourly paging loop, and `functions-esm/shared/usage-summary-support.js` no longer re-exports generic pagination as a shadow source for hourly scans.

The ESM edge layer still contains additional duplicated business logic beyond this slice. This change converts immediately reachable contract drift to shared modules and guardrails first, then continues function-by-function backend convergence without changing public slugs.
