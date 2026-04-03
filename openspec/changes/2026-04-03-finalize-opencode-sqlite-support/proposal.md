# Change: Finalize OpenCode SQLite Support

## Why

The tracker publicly supports OpenCode, but the current implementation in this worktree still depends on legacy message JSON files for sync and audit. Current OpenCode installs persist usage in `opencode.db`, so support is not operationally true unless the tracker reads SQLite and exposes when that path is degraded.

## What Changes

- Add SQLite-first OpenCode parsing to the local sync and audit paths
- Persist and expose OpenCode SQLite reader health in cursors, diagnostics, status, and doctor
- Document `opencode.db` as the current source of truth and `sqlite3` as the runtime prerequisite for full OpenCode support

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `src/lib/rollout.js`, `src/lib/opencode-sqlite.js`, `src/commands/sync.js`, `src/lib/diagnostics.js`, `src/commands/status.js`, `src/lib/doctor.js`, `src/lib/opencode-usage-audit.js`, `README.md`, `docs/AI_AGENT_INSTALL.md`
