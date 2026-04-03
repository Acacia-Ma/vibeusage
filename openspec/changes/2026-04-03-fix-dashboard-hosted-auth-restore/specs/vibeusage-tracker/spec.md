## ADDED Requirements

### Requirement: Dashboard hosted-auth restore is repository-owned

The dashboard SHALL restore hosted-auth session state through repository-owned `@insforge/sdk` hydration built on the installed SDK token manager and official auth primitives. The dashboard runtime MUST NOT depend on a React-provider restore layer that requires auth methods absent from the installed SDK contract.

#### Scenario: Hosted-auth restore survives SDK/react contract divergence

- **GIVEN** the installed `@insforge/sdk` exposes `auth.refreshSession()` and `auth.getCurrentUser()`
- **AND** the previously installed React adapter restore path expected `auth.getCurrentSession()`
- **WHEN** the user reloads the dashboard with a persisted hosted-auth session or a valid refresh cookie
- **THEN** the dashboard SHALL restore signed-in state through repository-owned SDK hydration
- **AND** the user SHALL remain on the dashboard without being forced into a fresh GitHub OAuth login

#### Scenario: Dashboard runtime excludes the broken provider restore layer

- **GIVEN** the dashboard runtime dependencies are installed from the repository manifest
- **WHEN** the dashboard build/test guardrails inspect the dashboard dependency graph and entrypoints
- **THEN** `@insforge/react` and `@insforge/react-router` SHALL NOT be required by the dashboard runtime
- **AND** the dashboard entrypoint SHALL mount the router directly while keeping the existing hosted-auth redirect pages
