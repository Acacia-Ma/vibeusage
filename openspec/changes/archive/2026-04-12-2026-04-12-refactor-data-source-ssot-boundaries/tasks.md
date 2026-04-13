## 1. Spec freeze

- [x] 1.1 Replace leaderboard fallback-read requirements with snapshot-only read requirements.
- [x] 1.2 Modify the OpenCode local usage requirement so `opencode.db` becomes the only supported accounting source.
- [x] 1.3 Tighten dashboard provenance requirements for live snapshot reuse vs cache fallback.

## 2. Leaderboard hard-cut

- [x] 2.1 Remove `_current` fallback reads and request-time `generated_at` synthesis from `insforge-src/functions-esm/vibeusage-leaderboard.js`.
- [x] 2.2 Keep leaderboard list/profile freshness semantics aligned on the same snapshot contract.
- [x] 2.3 Update leaderboard regression tests and `test/ssot-foundations.test.js`.

## 3. OpenCode hard-cut

- [x] 3.1 Remove legacy message-file accounting from `src/commands/sync.js`, `src/lib/rollout.js`, and `src/lib/opencode-usage-audit.js`.
- [x] 3.2 Keep diagnostics/status/doctor focused on SQLite reader health without using legacy message files as fallback truth.
- [x] 3.3 Update OpenCode parsing and audit regression tests plus README documentation.

## 4. Dashboard provenance audit

- [x] 4.1 Ensure usage/trend/model-breakdown hooks treat prior backend snapshots as continuity helpers, not a second live source.
- [x] 4.2 Ensure cache fallback appears only after backend failure and is labeled `cache` with a truthful last-updated timestamp.
- [x] 4.3 Add regression coverage for provenance labels and continuity semantics.

## 5. Verification

- [x] 5.1 Run `node --test --test-concurrency=1 test/edge-functions.test.js test/ssot-foundations.test.js`.
- [x] 5.2 Run `node --test --test-concurrency=1 test/rollout-parser.test.js test/opencode-usage-audit.test.js test/ssot-foundations.test.js`.
- [x] 5.3 Run `npm test -- --run src/hooks/use-usage-data.test.tsx src/hooks/use-trend-data.test.ts src/hooks/use-usage-model-breakdown.test.ts src/hooks/use-activity-heatmap.test.ts`.
- [x] 5.4 Run `npm run ci:local`.
