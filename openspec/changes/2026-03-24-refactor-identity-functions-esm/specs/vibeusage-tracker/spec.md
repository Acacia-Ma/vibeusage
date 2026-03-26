## MODIFIED Requirements

### Requirement: Dashboard shows identity information from login state

The dashboard UI SHALL show the authenticated viewer's identity from the current-user profile. The current-user profile SHALL be the single source of truth for dashboard display identity. Session payload fields and redirect parameters MUST NOT be treated as authoritative display identity. The dashboard SHALL resolve that identity through the canonical backend viewer-identity resolver rather than reading `profile.name` directly from auth session payloads.

#### Scenario: Dashboard identity panel resolves profile-backed identity

- **GIVEN** the user is signed in with a valid `accessToken` and `userId`
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL resolve display identity from the authenticated user's profile through the backend viewer-identity endpoint
- **AND** it SHALL ignore stale or missing session `name` fields for display purposes
- **AND** it SHALL fall back to the anonymous label only when the resolved profile lacks a usable display name

#### Scenario: Token-only session restore hydrates profile before display

- **GIVEN** the dashboard restores a valid auth session that includes `accessToken` and `userId` but lacks display identity fields
- **WHEN** the dashboard resolves the current viewer identity
- **THEN** it SHALL hydrate profile data from the backend using the authenticated `userId`
- **AND** the identity panel SHALL display the hydrated profile name instead of deriving identity from session fallbacks

## ADDED Requirements

### Requirement: Canonical display identity precedence is shared across viewer and public surfaces

The system SHALL resolve display identity with one canonical precedence order across `vibeusage-viewer-identity`, `vibeusage-public-view-profile`, and `vibeusage-leaderboard-refresh`: `nickname -> profile.name -> profile.full_name -> metadata.full_name -> metadata.name`. Those endpoints SHALL share one backend resolver implementation so the deployed behavior cannot diverge by surface.

#### Scenario: Viewer and public identity surfaces resolve the same display name

- **GIVEN** a user row where the first usable display field is `metadata.full_name`
- **WHEN** the dashboard viewer-identity endpoint, the public-view-profile endpoint, and leaderboard snapshot refresh resolve that user
- **THEN** all three SHALL emit the same sanitized display name
- **AND** none of them SHALL require `profile.name` to be populated first
