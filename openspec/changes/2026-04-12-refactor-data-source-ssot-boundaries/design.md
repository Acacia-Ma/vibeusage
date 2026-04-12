# Design: Data-source SSOT boundaries

## Context

The current repository already states strong SSOT principles, but three public-facing fact domains still permit multiple read paths or multiple provenance interpretations:

1. `vibeusage-leaderboard` reads snapshots first but still falls back to `_current` views and synthesizes `generated_at` from request time.
2. OpenCode sync still passes both `messageFiles` and `opencodeDbPath` into local accounting, so `opencode.db` is not yet the only operational truth.
3. Dashboard usage hooks already distinguish `edge` and `cache`, but the spec does not yet make immediate snapshot reuse vs cache fallback explicit enough to prevent provenance drift.

## GitHub / OpenSpec guidance used

GitHub research against the official `Fission-AI/OpenSpec` docs reinforces three points that shape this update:

- `openspec/specs/` is the source of truth for current behavior, while `openspec/changes/` holds reviewable proposed modifications.
- Active changes can evolve freely; updating artifacts or adding a new focused change is allowed when intent or scope becomes clearer.
- `## MODIFIED Requirements` replaces existing behavior, while `## REMOVED Requirements` is the right tool when an old fallback path must disappear completely.

## Why this is a new change package

This work is intentionally a new change package instead of reopening `2026-03-24-refactor-ssot-foundations`:

- the older SSOT umbrella already converged many shared helpers and cache protocols,
- its remaining unchecked work is not the same problem as these hard-cut data-source boundaries,
- and this package needs clean review around breaking removal of multi-source read paths.

## Fact-domain matrix

| Domain | Authoritative source | Allowed derived layer | Forbidden second truth |
| --- | --- | --- | --- |
| Leaderboard list/profile reads | `public.vibeusage_leaderboard_snapshots` | async refresh materializes the snapshot | `_current` leaderboard views used at request time |
| Leaderboard `generated_at` | snapshot row `generated_at` | none | request-time synthesis |
| OpenCode local accounting | `OPENCODE_HOME/opencode.db` | SQLite reader health surfaced through diagnostics/status | legacy message JSON accounting |
| Dashboard live provenance | successful backend response | prior successful backend snapshot for the same params while refresh is in flight | cache/local state presented as fresh backend truth |
| Dashboard degraded provenance | browser cache after failed backend request | stale label + last-updated timestamp | `edge` label on cache-only state |

## Decisions

### 1. Snapshot-only leaderboard read contract

Leaderboard list and profile endpoints must resolve from the same snapshot-backed store. If the requested snapshot is missing or stale, the endpoint should return an explicit not-ready response rather than silently switching to `_current` views.

### 2. Snapshot `generated_at` is materialization time, not request time

`generated_at` must describe when the authoritative leaderboard snapshot was produced. It must never be synthesized with `new Date().toISOString()` during a fallback read path.

### 3. OpenCode accounting becomes SQLite-only

`opencode.db` becomes the only supported local accounting source for OpenCode truth. Legacy message files may still exist on disk, but they are no longer an accounting input, no longer a fallback, and no longer part of diagnostics truth.

### 4. Dashboard provenance must describe derivation honestly

The dashboard may keep continuity UX, but its labels must match the actual derivation path:

- `edge` = current backend response, or a reused snapshot from a previous successful backend response for the same request.
- `cache` = browser-local fallback shown only after a backend request fails.
- `mock` = mock data only.

### 5. Regression guards must encode the contract

The implementation should add regression coverage that specifically prevents:

- leaderboard `_current` fallback reintroduction,
- request-time `generated_at` synthesis,
- OpenCode message-file accounting from reappearing,
- and dashboard cache states being mislabeled as live backend truth.

## Non-goals

- No new compatibility bridge or third storage path.
- No silent migration period with permanent dual-read behavior.
- No client-local recomputation presented as backend truth.
