# vibeusage Retrospectives (L1 Cards)

- **2026-02-17 — Session Close Trigger Retrospective** (`fullstack`, `session-close`, `S3`)
  - file: `2026-02-17-session-close-0023-1472963598577041574.md`
  - tags: `design_mismatch=no`, `detection_gap=no`
  - quick take: Discord thread close event triggered the session-end retrospective workflow; follow-up analysis remains intentionally lightweight.

- **2026-03-28 — Dashboard Display Model Prefix Regression** (`fullstack`, `dashboard-model-display`, `S2`)
  - file: `2026-03-28-dashboard-display-model-prefix-regression.md`
  - tags: `design_mismatch=yes`, `detection_gap=yes`
  - quick take: Backend and deploys were correct, but cache fallback and component-level raw-model fallback still leaked vendor-prefixed labels.

- **2026-02-14 — Leaderboard Public View Clickability + Mobile Landing Fallback** (`fullstack`, `leaderboard-public-view`, `S2`)
  - file: `2026-02-14-leaderboard-public-view-clickability.md`
  - tags: `design_mismatch=yes`, `detection_gap=yes`
  - quick take: Replaced display-name inference with explicit `is_public` gating and fixed mobile nav auth fallback caused by full-page navigation.

- **2026-02-14 — OpenClaw Usage Ingest Gap** (`backend`, `openclaw-sync`, `S1`)
  - file: `2026-02-14-openclaw-ingest-gap.md`
  - tags: `design_mismatch=yes`, `detection_gap=yes`
  - quick take: JSONL-only assumption failed in production; fallback ingest + backfill restored data integrity.
