## Context

The dashboard currently derives current-user display identity from multiple carriers:

- `session.user.profile.name ?? session.user.name`
- loopback redirect query param `name`
- UI-local fallbacks in `DashboardPage`

This creates drift between authentication state and display state. The failure mode is visible when session recovery restores a valid access token but the session carrier lacks display identity, causing the UI to fall back to `ANONYMOUS`.

## Goals / Non-Goals

- Goals:
  - Enforce a single source of truth for authenticated dashboard identity.
  - Preserve token-only session recovery without allowing it to become a display-identity source.
  - Remove display identity from redirect payloads.
  - Keep anonymous fallback as a single, centralized resolver behavior.
- Non-Goals:
  - Redesign leaderboard/public-profile rules for other users.
  - Change auth token semantics or backend authorization boundaries.
  - Add compatibility shims that preserve the old multi-source identity model.

## Decisions

- Decision: The backend user profile is the only authoritative source for dashboard display identity.
  - Why: Display identity is business/profile data, not authentication state.
- Decision: Session state remains auth-focused and may carry cached user data, but cached session fields are never authoritative for UI display.
  - Why: Session recovery must remain resilient, but the UI must resolve identity from one place.
- Decision: Redirect payloads stop carrying `name`.
  - Why: URL transport of display identity is a duplicated, stale-prone representation.
- Decision: The dashboard introduces one current-identity resolver/hook that hydrates `displayName` and `avatarUrl` from profile data using authenticated `userId`.
  - Why: All dashboard views should consume one derived object instead of reassembling identity ad hoc.

## Alternatives Considered

- Session as the sole identity source.
  - Rejected because it is a cached snapshot and already demonstrated drift.
- Redirect payload as the identity source.
  - Rejected because display identity must not travel as URL state.
- Preserve current multi-source behavior and patch each missing field.
  - Rejected because it deepens duplication and violates the project constitution.

## Risks / Trade-offs

- Hydrating profile after session recovery can add one authenticated request on cold restore paths.
- The frontend must define loading behavior for identity-dependent UI during hydration.
- Existing code that reads `auth.name` directly must be migrated in one pass to avoid dual-path logic.

## Validation

- Regression: token-only restore with valid `userId` hydrates display name from profile.
- Regression: redirect payload no longer includes `name`.
- Regression: `DashboardPage` renders current-user identity from the centralized resolver, not `auth.name`.
- Regression: missing profile name falls back to the anonymous label only in the centralized resolver.

