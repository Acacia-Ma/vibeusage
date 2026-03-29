---
repo: vibeusage
layer: fullstack
module: dashboard-model-display
severity: S2
design_mismatch: yes
detection_gap: yes
reusable_for:
  - dashboard
  - display-model
  - cache fallback
  - release verification
  - repo-sitemap
owner: Victor
status: mitigated
report_date: 2026-03-28
incident_window: 2026-03-28..2026-03-28
---

# Postmortem: Dashboard Display Model Prefix Regression

## L2 Brief (2 min)

- **What happened:** Dashboard model lists still showed vendor-prefixed names such as `anthropic/claude-opus-4.6` after backend and frontend changes were already shipped to hide prefixes in presentation.
- **Why design mismatch happened:** We treated `display_model` as if it had a single delivery path, but the rendered label actually depended on multiple layers: live edge responses, dashboard cache fallback, live snapshot reuse, and component-level fallback to raw `model`.
- **Why not detected early:** Verification checked individual layers (`backend returns display_model`, `frontend bundle updated`) instead of the single question that matters: which field the rendered page finally uses under each runtime path.
- **What fixed it:** Added compatibility hydration for cached/snapshotted model breakdown payloads and a final UI fallback that strips vendor prefixes even when `display_model` is absent. Re-deployed dashboard after verifying the new production bundle.
- **When to read this next time:** Any work touching dashboard model presentation, response display fields, browser cache fallbacks, or release verification for user-visible model names.

## 1. Scope

- In scope:
  - Dashboard model name presentation.
  - `useUsageModelBreakdown` cache and live snapshot fallback behavior.
  - `buildFleetData`, `buildTopModels`, and `DashboardPage` model label selection.
  - Production deployment verification for dashboard bundles.
- Out of scope:
  - Pricing calculation logic.
  - Canonical `model_id` aggregation rules.
  - Database schema or alias table contracts.

## 2. Plan Before Incident

- Intended outcomes:
  - Backend returns `display_model` as a response-only display field.
  - Frontend prefers `display_model` and keeps `model_id` as the only aggregation key.
  - Users see clean labels such as `claude-opus-4.6` instead of `anthropic/claude-opus-4.6`.
- Key assumptions:
  - Updating edge responses would be sufficient for all UI paths.
  - Frontend refresh plus deployment would automatically eliminate stale prefixed labels.
  - Cache fallback paths behaved the same as fresh-response paths.

## 3. Outcome vs Plan

- Actual outcome:
  - Backend was updated correctly.
  - Frontend bundle was updated correctly.
  - The page still showed vendor prefixes because some runtime paths bypassed `display_model`.
- Deviations/gaps:
  - Cached `modelBreakdown` payloads could lack `display_model`.
  - When `display_model` was absent, presentation helpers and `DashboardPage` still fell back to raw `model` without stripping prefixes.
  - Investigation moved layer by layer rather than starting from the final rendered label decision chain.

## 4. Impact

- User/business impact:
  - Dashboard looked inconsistent and reduced trust in the pricing/model presentation cleanup.
  - Same semantic model could appear as a “clean” name in one path and a vendor-prefixed name in another.
- Ops/debug impact:
  - Multiple deployments and re-verifications were needed.
  - Time was lost because fixes targeted plausible layers one at a time instead of validating the full end-to-end render path first.

## 5. Timeline

- Detection:
  - User reported that dashboard still showed prefixed labels after `display_model` work had been deployed.
- Mitigation:
  - Verified live edge functions and production frontend bundle.
  - Investigated browser-local cached `modelBreakdown` payloads and confirmed stale entries without `display_model`.
  - Added cache/snapshot hydration for `display_model`.
- Resolution:
  - Identified remaining component-level fallback to raw `model`.
  - Added final presentation stripping in dashboard helpers and `DashboardPage`.
  - Rebuilt and re-deployed production frontend bundle.

## 6. Evidence

- Runtime paths involved:
  - `dashboard/src/hooks/use-usage-model-breakdown.ts`
  - `dashboard/src/lib/dashboard-cache.ts`
  - `dashboard/src/lib/dashboard-live-snapshot.ts`
  - `dashboard/src/lib/model-breakdown.ts`
  - `dashboard/src/pages/DashboardPage.jsx`
- Verified production behavior:
  - Live site served updated bundle `main-DaTRuwtD.js`.
  - Cached browser entries existed without `display_model`.
- Regression coverage:
  - `node --test test/model-breakdown.test.js`
  - `npm --prefix dashboard test -- --run src/hooks/use-usage-model-breakdown.test.ts`
  - `npm --prefix dashboard run build`

## 7. Root Causes

- Primary:
  - There was no single, explicitly enforced source of truth for dashboard display-name selection.
- Secondary:
  - Cache fallback and fresh-response paths were not validated as one contract.
- Tertiary:
  - Release verification checked “did we deploy?” and “does backend return the field?” instead of “what exact label reaches the user under each runtime branch?”.
- Stage attribution:
  - Design: display-name decision point not unified.
  - Frontend integration: fallback paths leaked raw `model`.
  - Verification: no A/B matrix for fresh response vs cache fallback vs missing `display_model`.

## 8. Action Items

- [ ] Add a dashboard regression that asserts prefixed raw `model` still renders without vendor prefix when `display_model` is missing. (Owner: Victor, Due: 2026-03-29)
- [ ] Add a release verification note for user-visible display fields: verify fresh response path and cache-fallback path separately. (Owner: Victor, Due: 2026-03-29)
- [ ] Keep the model display debug path in `docs/repo-sitemap.md` current whenever dashboard display flow changes. (Owner: Victor, Due: 2026-03-29)
- [ ] For future multi-layer bugs, require a single “rendered value decision chain” write-up before patching individual layers. (Owner: Victor, Due: 2026-03-29)

## 9. Prevention Rules

- Rule 1: User-visible model labels must have one final presentation decision point, even if upstream fields differ.
- Rule 2: Any display-only field introduced by the backend must be validated across fresh fetch, cache fallback, and in-memory snapshot reuse.
- Rule 3: Release verification for display regressions must answer the end-user question directly: “What exact text is rendered on screen?”.
- Enforcement:
  - Dashboard regression tests for prefixed raw model fallback.
  - Repo sitemap first-read path for model display debugging.
  - Investigation template that lists A/B paths before code changes.

## 10. Follow-up

- Checkpoint date: 2026-03-29
- Success criteria:
  - No dashboard path can render vendor-prefixed names when the intent is presentation-only display.
  - Future investigations start from the rendered-label decision chain, not isolated backend or deploy assumptions.
  - `docs/repo-sitemap.md` remains accurate for this module's display/debugging path.
