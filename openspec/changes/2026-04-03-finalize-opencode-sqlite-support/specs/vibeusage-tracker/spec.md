## ADDED Requirements

### Requirement: OpenCode local usage parsing is SQLite-first

The CLI SHALL treat `~/.local/share/opencode/opencode.db` (or `OPENCODE_HOME/opencode.db`) as the current authoritative OpenCode local usage source. Legacy message JSON files MAY still be parsed when present, but SQLite-backed usage MUST be included when the database exists.

#### Scenario: Sync reads OpenCode SQLite data without legacy message files

- **GIVEN** an OpenCode home that contains `opencode.db`
- **AND** the legacy message JSON directory is empty or absent
- **WHEN** a user runs `npx vibeusage sync`
- **THEN** the CLI SHALL still parse OpenCode local usage from SQLite
- **AND** it SHALL aggregate tokens using the same half-hour bucket model as other local sources

#### Scenario: OpenCode project attribution uses project worktree

- **GIVEN** an OpenCode SQLite message row linked through `session.project_id`
- **WHEN** the tracker attributes project-scoped usage
- **THEN** it SHALL resolve the project path from `project.worktree`
- **AND** it SHALL NOT infer the project path from legacy message file locations

## MODIFIED Requirements

### Requirement: Auto sync health is diagnosable

The CLI SHALL expose sufficient diagnostics to determine whether auto sync is functioning, degraded, or failing. This output MUST include OpenCode SQLite reader health when OpenCode support is enabled.

#### Scenario: User validates auto sync health

- **WHEN** a user runs `npx vibeusage status --diagnostics`
- **THEN** the output SHALL include the latest notify timestamp, last notify-triggered sync timestamp, queue pending bytes, upload throttle state, and any scheduled auto retry state
- **AND** it SHALL include an `opencode` diagnostics block with the SQLite DB path, DB presence, SQLite reader status, last SQLite check time, cursor update time, and last SQLite error code

#### Scenario: Doctor surfaces degraded OpenCode SQLite support

- **WHEN** a user runs `npx vibeusage doctor --json`
- **THEN** the report SHALL include a non-critical `opencode.sqlite_support` check
- **AND** `missing-db` or `never_checked` SHALL map to `warn`
- **AND** `missing-sqlite3` or `query-failed` SHALL map to `fail`
- **AND** degraded OpenCode SQLite support SHALL NOT increase `summary.critical`
