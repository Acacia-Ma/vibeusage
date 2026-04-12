# Change: Refactor data-source SSOT boundaries

## Why

VibeUsage still has a few user-visible fact contracts that can answer from two stores or two provenance stories. The biggest remaining cases are leaderboard list reads (snapshot rows vs `_current` views), OpenCode local accounting (`opencode.db` vs legacy message JSON files), and dashboard continuity labels (live backend truth vs local continuity helpers). This ambiguity makes production debugging non-deterministic and violates the repository's single-source-of-truth rule.

## What Changes

- Hard-cut leaderboard read contracts to snapshot-backed rows only and remove `_current` fallback reads.
- Make leaderboard freshness explicit: missing or stale snapshots return an explicit not-ready response instead of synthesizing `generated_at` at request time.
- Hard-cut OpenCode local accounting to `OPENCODE_HOME/opencode.db` and remove legacy message-file accounting from sync, audit, status, and diagnostics truth.
- Tighten dashboard provenance semantics so backend success is the only live truth; prior backend snapshot reuse is continuity only; cache after failure is a degraded fallback.
- Add regression guard requirements so a second truth source cannot reappear silently.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `insforge-src/functions-esm/vibeusage-leaderboard.js`, `insforge-src/functions-esm/vibeusage-leaderboard-profile.js`, `insforge-src/functions-esm/vibeusage-leaderboard-refresh.js`, `src/commands/sync.js`, `src/lib/rollout.js`, `src/lib/opencode-usage-audit.js`, `src/commands/status.js`, `src/lib/diagnostics.js`, `dashboard/src/hooks/use-usage-data.ts`, `dashboard/src/hooks/use-trend-data.ts`, `dashboard/src/hooks/use-usage-model-breakdown.ts`, `dashboard/src/lib/dashboard-live-snapshot.ts`, `dashboard/src/lib/dashboard-cache.ts`, `README.md`, `README.zh-CN.md`, `test/edge-functions.test.js`, `test/rollout-parser.test.js`, `test/opencode-usage-audit.test.js`, `test/ssot-foundations.test.js`
- Related changes: narrows the remaining unresolved data-source boundaries left after `2026-03-24-refactor-ssot-foundations`, and intentionally supersedes the permissive OpenCode coexistence rule currently present in the stable `vibeusage-tracker` spec.
