## MODIFIED Requirements

### Requirement: Dashboard shows identity information from current-user profile

The dashboard UI SHALL show the authenticated viewer's identity from the current-user profile. The current-user profile SHALL be the single source of truth for dashboard display identity. Session payload fields and redirect parameters MUST NOT be treated as authoritative display identity.

#### Scenario: Dashboard identity panel resolves profile-backed identity

- **GIVEN** the user is signed in with a valid `accessToken` and `userId`
- **WHEN** the dashboard renders the identity panel
- **THEN** it SHALL resolve display identity from the authenticated user's profile
- **AND** it SHALL ignore stale or missing session `name` fields for display purposes
- **AND** it SHALL fall back to the anonymous label only when the resolved profile lacks a usable display name

#### Scenario: Token-only session restore hydrates profile before display

- **GIVEN** the dashboard restores a valid auth session that includes `accessToken` and `userId` but lacks display identity fields
- **WHEN** the dashboard resolves the current viewer identity
- **THEN** it SHALL hydrate profile data from the backend using the authenticated `userId`
- **AND** the identity panel SHALL display the hydrated profile name instead of deriving identity from session fallbacks

## ADDED Requirements

### Requirement: Dashboard auth redirects do not carry display identity

Loopback auth redirect payloads used by the dashboard MUST NOT carry display identity fields such as `name`. Redirects MAY carry authentication metadata required to complete auth, but display identity SHALL be resolved only from the current-user profile after authentication.

#### Scenario: Redirect payload excludes display name

- **GIVEN** the dashboard completes an auth redirect flow
- **WHEN** it builds a loopback redirect URL
- **THEN** the redirect payload SHALL omit `name`
- **AND** subsequent dashboard rendering SHALL resolve display identity from the authenticated user's profile

