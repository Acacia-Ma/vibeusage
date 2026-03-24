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

The ESM edge layer still contains additional duplicated business logic beyond this slice. This change converts immediately reachable contract drift to shared modules and guardrails first, then continues function-by-function backend convergence without changing public slugs.
