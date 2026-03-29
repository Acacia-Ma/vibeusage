## ADDED Requirements

### Requirement: Dashboard period switches only refresh period-dependent modules

The dashboard SHALL treat `day|week|month|total` as the live state only for modules whose facts are period-scoped. Modules whose facts are recent or all-time SHALL keep their existing data and MUST NOT enter a period-triggered loading cycle.

#### Scenario: Recent usage remains stable during a period switch

- **GIVEN** the dashboard already displays recent usage metrics
- **WHEN** the user switches between `day`, `week`, `month`, or `total`
- **THEN** the recent usage module SHALL keep rendering its current data
- **AND** it SHALL NOT clear itself or start a period-triggered fetch

### Requirement: Dashboard modules own their own loading semantics

Each dashboard usage module SHALL derive its loading state from its own request lifecycle. A module MUST NOT remain in loading only because another module is still refreshing.

#### Scenario: CORE_INDEX ignores unrelated loading state

- **GIVEN** `CORE_INDEX` data has resolved
- **WHEN** trend, heatmap, or model breakdown are still loading
- **THEN** the dashboard SHALL render `CORE_INDEX` from its own resolved usage state
- **AND** the `CORE_INDEX` loading indicator SHALL reflect only the usage-summary request lifecycle

## MODIFIED Requirements

### Requirement: Dashboard usage modules use backend usage endpoints as live SSOT

The dashboard usage modules SHALL treat backend usage endpoints as the only live source of truth for usage facts. Frontend caches MAY be used only after request failure, and frontend modules MUST NOT publish `shared` or `client-derived` usage sources as if they were live backend data. Period-dependent modules SHALL preserve their previous visible state while a new backend refresh is in flight instead of clearing their cards before the next response arrives.

#### Scenario: Period switch preserves module stability during backend refresh

- **GIVEN** a period-dependent dashboard module is already rendering backend usage data
- **WHEN** the user switches to another period and the next backend request starts
- **THEN** the module SHALL keep its previous visible state until the new response or explicit local loading overlay is ready
- **AND** it SHALL NOT collapse to an empty card solely because the refresh has started

#### Scenario: Cache is used only after backend failure

- **GIVEN** the dashboard has cached usage data for a module
- **WHEN** the live backend request for that module fails
- **THEN** the dashboard MAY display the cached data with `DATA_SOURCE: CACHE`
- **AND** a successful backend response SHALL continue to display `DATA_SOURCE: EDGE`
