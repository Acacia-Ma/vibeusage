## MODIFIED Requirements

### Requirement: Dashboard auth/session uses a single persistent source

The dashboard SHALL use InsForge persistent session storage as the only authoritative auth/session source. Local dashboard storage MAY keep UI-only expiry markers, but MUST NOT store or restore a parallel auth payload.

#### Scenario: Reload after hosted auth

- **WHEN** the dashboard reloads after a successful hosted-auth flow
- **THEN** it resolves the active session from InsForge persistent storage
- **AND** it does not restore a separate dashboard auth object from local storage.

### Requirement: Copy registry parser is shared

The system SHALL parse `dashboard/src/content/copy.csv` through one shared parser implementation reused by runtime and validation tooling.

#### Scenario: Registry validation and runtime lookup read the same row

- **WHEN** a copy key exists in `copy.csv`
- **THEN** dashboard runtime lookup and registry validation interpret the same columns and normalized text from the same parser implementation.

### Requirement: Model breakdown top models use canonical identity

The dashboard SHALL aggregate top-model usage by backend-provided canonical `model_id`, not by display label.

#### Scenario: Alias display names differ across sources

- **WHEN** two rows share the same canonical `model_id` but have different display labels
- **THEN** the dashboard merges them into one top-model entry keyed by that `model_id`.

### Requirement: Shared runtime defaults define default endpoints

The CLI, dashboard, and supported operational scripts SHALL reuse one shared runtime-default contract for default base URLs and dashboard URLs.

#### Scenario: No explicit base URL is configured

- **WHEN** runtime configuration is resolved without CLI flags or environment overrides
- **THEN** all participating clients use the same default InsForge base URL from the shared runtime-default contract.
