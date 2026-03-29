# Change: Refactor dashboard period coupling and module responsiveness

## Why

The dashboard currently fans a single period switch into unrelated modules and aggregates loading state across multiple hooks. This makes `CORE_INDEX` feel slow and causes unrelated modules such as recent usage to blank or flash during period changes.

## What Changes

- Split dashboard module wiring so only period-dependent modules react to `day|week|month|total`.
- Introduce an independent recent usage hook instead of reusing `useUsageData.rolling`.
- Remove page-level loading aggregation for `CORE_INDEX` and preserve stable module state while refreshes are in flight.
- Add regression coverage for loading decoupling, recent usage independence, and stable refresh behavior.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/hooks`, `dashboard/src/ui/matrix-a/views/DashboardView.jsx`
