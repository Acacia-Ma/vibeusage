# Change: Refactor dashboard identity to a single profile source of truth

## Why

The current dashboard identity flow duplicates display identity across session payloads, redirect URL parameters, and UI-level fallbacks. This violates the project's single-source-of-truth principle and causes drift such as `Identity_Core` falling back to `ANONYMOUS` when session restoration lacks `name`.

## What Changes

- Make the authenticated user's backend profile the only authoritative source for dashboard display identity.
- Restrict auth session state to authentication facts (`accessToken`, `userId`, auth-only metadata) instead of display identity.
- Remove `name` from dashboard loopback redirect payloads.
- Introduce a single current-identity resolver/hook for dashboard views.
- Update the dashboard identity requirement and add regression coverage for token-only restore paths.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `dashboard/src/App.jsx`, `dashboard/src/pages/DashboardPage.jsx`, `dashboard/src/lib/auth-redirect.ts`, `dashboard/src/lib/insforge-auth-client.ts`, identity-related tests

