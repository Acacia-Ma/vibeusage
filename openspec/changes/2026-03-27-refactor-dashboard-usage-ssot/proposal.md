# Change: Refactor dashboard usage data flows to backend SSOT

## Why

The dashboard currently mixes backend responses, shared hook state, client-derived heatmap/trend data, and cache hydration. This weakens the usage data single-source-of-truth contract and makes period switches slower and harder to reason about.

## What Changes

- Remove frontend `shared` usage-trend data flow and always fetch trend data from backend usage endpoints.
- Remove frontend `client-derived` activity heatmap generation and treat the heatmap endpoint as the only authoritative heatmap source.
- Restrict dashboard cache usage to request-failure fallback instead of startup hydration.
- Keep `CORE_INDEX` and `Project Usage` on backend-owned usage functions without introducing new client-side aggregation.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `dashboard/src/hooks`, `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/components/ActivityHeatmap.jsx`
