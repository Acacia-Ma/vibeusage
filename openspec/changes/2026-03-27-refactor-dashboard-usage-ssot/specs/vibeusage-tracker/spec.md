## MODIFIED Requirements

### Requirement: Dashboard provides a GitHub-inspired activity heatmap

The dashboard UI SHALL render an activity heatmap from the backend `GET /functions/vibeusage-usage-heatmap` response, inspired by GitHub contribution graphs. The backend response SHALL be the authoritative live source for heatmap weeks, levels, and derived counters.

#### Scenario: Heatmap uses backend response as live source

- **GIVEN** the user is signed in and the dashboard provides timezone parameters
- **WHEN** the dashboard requests `GET /functions/vibeusage-usage-heatmap`
- **THEN** the UI SHALL render the returned `weeks`, `active_days`, and `streak_days` directly
- **AND** the frontend SHALL NOT rebuild heatmap levels from daily usage rows during the live request path

### Requirement: Dashboard deduplicates usage-daily requests

The dashboard MUST avoid issuing redundant `GET /functions/vibeusage-usage-daily` calls for the same `from/to/tz` window within a single refresh cycle, but it SHALL preserve backend ownership of daily data rather than sharing client-derived rows across modules.

#### Scenario: Duplicate daily reads are deduplicated without shared client state

- **GIVEN** `period=week`
- **WHEN** multiple dashboard modules need the same daily aggregate window
- **THEN** the dashboard networking layer SHALL collapse identical in-flight `usage-daily` reads
- **AND** the TREND chart SHALL NOT consume another hook's daily rows as its live source of truth

## ADDED Requirements

### Requirement: Dashboard usage modules use backend usage endpoints as live SSOT

The dashboard usage modules SHALL treat backend usage endpoints as the only live source of truth for usage facts. Frontend caches MAY be used only after request failure, and frontend modules MUST NOT publish `shared` or `client-derived` usage sources as if they were live backend data.

#### Scenario: Period switch enters backend loading state

- **GIVEN** the user switches between `day`, `week`, `month`, and `total`
- **WHEN** the dashboard starts the next usage fetch cycle
- **THEN** each usage module SHALL enter `loading` with `source=edge`
- **AND** it SHALL NOT pre-hydrate the visible state from cache or another module's results

#### Scenario: Cache is used only after backend failure

- **GIVEN** the dashboard has cached usage data for a module
- **WHEN** the live backend request for that module fails
- **THEN** the dashboard MAY display the cached data with `DATA_SOURCE: CACHE`
- **AND** a successful backend response SHALL continue to display `DATA_SOURCE: EDGE`
