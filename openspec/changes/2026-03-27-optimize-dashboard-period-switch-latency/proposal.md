# Change: Optimize dashboard period switch latency and visual continuity

## Why

Dashboard period switches still feel slow even after period coupling was removed. The current hooks wait for fresh backend responses before the target period can visibly settle, which leaves users with a noticeable pause and occasional card-state jumps during `day|week|month|total` switches.

## What Changes

- Add target-period snapshot hydration for period-bound dashboard modules so previously resolved periods can render immediately.
- Distinguish initial empty loading from background refreshing, allowing visible data to remain on screen while the next period revalidates.
- Keep dashboard period switches visually stable by avoiding empty-card transitions during backend refreshes.
- Add regression coverage for snapshot hydration, background refreshing semantics, and usage panel continuity.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `dashboard/src/hooks/use-usage-data.ts`, `dashboard/src/hooks/use-trend-data.ts`, `dashboard/src/hooks/use-usage-model-breakdown.ts`, `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`
