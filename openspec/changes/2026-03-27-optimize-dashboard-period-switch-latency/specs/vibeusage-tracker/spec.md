## ADDED Requirements

### Requirement: Period-bound dashboard modules hydrate previously resolved periods immediately

Dashboard modules whose facts depend on `day|week|month|total` SHALL retain an in-memory snapshot of the last successful backend response for each resolved period key. When the user revisits a period whose snapshot is already available, the module SHALL render that snapshot immediately and continue refreshing in the background.

#### Scenario: Revisiting a resolved period hydrates immediately

- **GIVEN** the dashboard has already resolved backend data for a period-scoped module under `week`
- **AND** the user later switches away and returns to `week`
- **WHEN** the period switch occurs
- **THEN** the module SHALL render the last successful `week` snapshot immediately
- **AND** it SHALL continue background revalidation against the backend without first showing an empty state

### Requirement: Period switches distinguish empty loading from background refreshing

Dashboard period switches SHALL distinguish between an initial empty load and a background refresh of already visible data. A module with visible data SHALL remain rendered while the next backend request is in flight.

#### Scenario: Visible data stays on screen during period refresh

- **GIVEN** a period-bound module is already rendering visible data
- **WHEN** the user switches to another period and the backend request starts
- **THEN** the module SHALL keep visible content on screen while the refresh is in flight
- **AND** the dashboard MAY show an updating indicator
- **AND** it SHALL NOT collapse to a blank card solely because the request has started

## MODIFIED Requirements

### Requirement: Dashboard usage modules use backend usage endpoints as live SSOT

The dashboard usage modules SHALL treat backend usage endpoints as the only live source of truth for usage facts. Frontend caches MAY be used only after request failure, and frontend modules MUST NOT publish `shared` or `client-derived` usage sources as if they were live backend data. Period-dependent modules SHALL preserve their previous visible state while a new backend refresh is in flight, and they MAY hydrate an immediate period-scoped snapshot only when that snapshot was produced by a prior successful backend response for the same target period.

#### Scenario: Snapshot hydration preserves SSOT semantics

- **GIVEN** the dashboard has a locally retained snapshot for a target period
- **WHEN** the user switches to that period
- **THEN** the dashboard MAY render that snapshot immediately
- **AND** the snapshot SHALL represent the last successful backend response for the same target period
- **AND** the dashboard SHALL continue backend revalidation instead of treating the snapshot as a second source of truth
