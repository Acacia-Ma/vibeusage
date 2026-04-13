## MODIFIED Requirements

### Requirement: Leaderboard response includes generation timestamp

The leaderboard endpoint SHALL include a `generated_at` timestamp from the authoritative snapshot row used to answer the request. Request handlers MUST NOT synthesize `generated_at` from request time when no snapshot row was used.

#### Scenario: Response includes snapshot generated_at

- **GIVEN** a snapshot exists for `period=week` with `generated_at`
- **WHEN** the user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **THEN** the response SHALL include that snapshot `generated_at`
- **AND** the value SHALL describe snapshot materialization time, not request time

### Requirement: Dashboard retains last-known data during backend failures

The dashboard MUST treat successful backend responses as the only live usage truth. A previously resolved backend snapshot for the same request MAY be reused immediately while a new request is in flight, but cache fallback after a failed request MUST be labeled cached/stale with a last-updated timestamp.

#### Scenario: Resolved backend snapshot is reused during refresh

- **GIVEN** the user has previously loaded usage data successfully for the same request parameters
- **WHEN** the dashboard starts a new refresh for those same parameters
- **THEN** it MAY continue rendering the prior backend-derived snapshot while the refresh is in flight
- **AND** it SHALL NOT present browser cache as the current source unless the refresh fails

#### Scenario: Backend unavailable after prior success

- **GIVEN** the user has previously loaded usage data successfully
- **WHEN** subsequent backend requests fail (network error or 5xx)
- **THEN** the dashboard SHALL continue to display the last-known usage summary, daily totals, and heatmap
- **AND** the UI SHALL label the data as cached/stale and show the last-updated timestamp

### Requirement: Dashboard shows data source indicator

The dashboard SHALL display a data source label (`edge|cache|mock`) for usage and activity panels with these semantics: `edge` means a successful backend response or a reused snapshot from a previous successful backend response for the same request; `cache` means browser-local fallback shown only after a failed backend request; `mock` means local mock data. Client-derived-only continuity state MUST NOT be labeled `edge`.

#### Scenario: Immediate snapshot reuse remains backend-derived

- **GIVEN** the dashboard has a prior successful backend snapshot for the same request
- **WHEN** the next refresh starts and the UI reuses that snapshot before the network response resolves
- **THEN** the UI SHALL show `DATA_SOURCE: EDGE`
- **AND** it SHALL preserve the snapshot's last-updated timestamp

#### Scenario: Cache fallback is explicit

- **GIVEN** the user is signed in and cached data is used due to a fetch failure
- **WHEN** the dashboard renders usage or activity panels
- **THEN** the UI SHALL show `DATA_SOURCE: CACHE`

### Requirement: OpenCode local usage parsing is SQLite-first

The CLI SHALL treat `~/.local/share/opencode/opencode.db` (or `OPENCODE_HOME/opencode.db`) as the only authoritative OpenCode local usage source for sync, audit, status, and diagnostics truth. Legacy message JSON files MUST NOT be parsed, merged, or used as fallback accounting input.

#### Scenario: Sync reads OpenCode SQLite data without legacy message files

- **GIVEN** an OpenCode home that contains `opencode.db`
- **AND** the legacy message JSON directory is empty or absent
- **WHEN** a user runs `npx vibeusage sync`
- **THEN** the CLI SHALL still parse OpenCode local usage from SQLite
- **AND** it SHALL aggregate tokens using the same half-hour bucket model as other local sources

#### Scenario: SQLite degradation is explicit

- **GIVEN** `opencode.db` is missing or unreadable
- **WHEN** a user runs `npx vibeusage sync` or an OpenCode diagnostic command
- **THEN** the CLI SHALL report degraded or missing OpenCode SQLite support
- **AND** it SHALL NOT substitute legacy message-file totals as OpenCode usage truth

### Requirement: Leaderboard is served from precomputed snapshots

The system SHALL serve leaderboard list and profile data from `public.vibeusage_leaderboard_snapshots` for the requested `period`. Read endpoints MUST NOT fall back to `_current` views or any second read store for the same leaderboard contract.

#### Scenario: Leaderboard reads from latest snapshot

- **GIVEN** a snapshot exists for `period=week` with `generated_at`
- **WHEN** a signed-in user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **THEN** the response SHALL reflect the latest snapshot totals (`gpt_tokens`, `claude_tokens`, `total_tokens`)
- **AND** the response SHALL include the snapshot `generated_at`
- **AND** leaderboard list and profile reads SHALL follow the same snapshot-backed freshness semantics

#### Scenario: Snapshot unavailable is explicit

- **GIVEN** no snapshot exists or the snapshot is stale for the requested period
- **WHEN** a signed-in user calls `GET /functions/vibeusage-leaderboard?period=week&metric=all`
- **THEN** the endpoint SHALL return a structured non-success response that identifies snapshot unavailability
- **AND** it SHALL NOT fall back to `_current` views
- **AND** it SHALL NOT synthesize a fresh `generated_at` at request time

## REMOVED Requirements

### Requirement: Leaderboard fallback query SHALL apply pagination at source

**Reason**: the leaderboard fallback read path is removed; the contract now has one authoritative snapshot-backed read store.
**Migration**: delete `_current` fallback queries and their pagination-specific regression paths.

### Requirement: Leaderboard fallback SHOULD use single query when possible

**Reason**: snapshot-only reads make fallback-query orchestration obsolete.
**Migration**: keep `entries` and `me` retrieval inside the snapshot contract only.
