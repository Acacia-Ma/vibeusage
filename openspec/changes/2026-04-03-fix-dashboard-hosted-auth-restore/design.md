## Context

Issue `#118` is now narrowed to a single contract mismatch on the upgraded baseline from PR `#124` (`c9d5c0df`):

- installed SDK contract: `auth.refreshSession()` and `auth.getCurrentUser()`
- installed React adapter restore path: `auth.getCurrentSession()`

The repository already removed its old `clearSession() + getCurrentSession()` refresh hack and replaced session hydration with a token-manager-backed bridge plus SDK current-user hydration. The remaining failure is that the dashboard runtime still mounts the official React provider, so the broken restore call can run before the repository-owned path takes over.

## Goals / Non-Goals

- Goals:
  - restore hosted-auth sessions on the upgraded baseline without a full OAuth re-login
  - keep the official SDK baseline from PR `#124`
  - make dashboard auth restore repository-owned and explicit
  - block future reintroduction of the broken provider/runtime dependency
- Non-Goals:
  - patching or forking `@insforge/react`
  - rolling back any InsForge package versions
  - changing backend auth policy, token formats, or GitHub OAuth flow design

## Invariants

- Invariant: dashboard hosted-auth restore MUST use the installed `@insforge/sdk` contract as the only runtime auth source of truth.
  - Why: the provider contract is already proven inconsistent with the installed SDK.
  - Signal: runtime restore goes through repository-owned `getCurrentInsforgeSession()` / `auth.signOut()` calls only.
- Invariant: the follow-up MUST NOT reintroduce `clearSession() + getCurrentSession()` refresh hacks or compatibility shims.
  - Why: they would preserve the old broken contract instead of removing it.
  - Signal: no repository file calls `sdk.auth.getCurrentSession()` and no shim/fork/patch-package is added.
- Invariant: GitHub OAuth redirect remains on the official SDK client path.
  - Why: the callback exchange already happens inside the installed SDK and does not require the React provider.
  - Signal: redirect init still uses `auth.signInWithOAuth()` and the SDK callback exchange.

## Boundary Matrix

Case | Preconditions | Input | Expected Output | Side Effects
--- | --- | --- | --- | ---
Dashboard cold load with persisted session | token bridge contains valid session or refresh cookie is valid | user opens dashboard | signed-in state restores without full GitHub re-login | local `insforgeLoaded` flips true after repo-owned hydration
Dashboard sign-out | hosted-auth session is active | user clicks sign out | SDK sign-out clears auth state and dashboard falls back to landing | repo-owned storage is cleared
Dashboard request retry | business request hits invalid-signature auth failure | request wrapper refreshes | retry uses repo-owned `refreshInsforgeSession()` result | no provider restore path is invoked
Dashboard dependency graph | app installs dashboard runtime deps | build/test check dependency manifest | `@insforge/react` and `@insforge/react-router` are absent from dashboard runtime deps | bundle cannot regress to provider restore by accident

## Decisions

- Decision: remove `@insforge/react` / `@insforge/react-router` from dashboard runtime instead of adapting them locally.
  - Rationale: the issue is a provider/runtime contract mismatch, not missing repository glue.
- Decision: let `App.jsx` own the minimal hosted-auth load/sign-out state needed for gating and redirect behavior.
  - Rationale: the app already owns the visible auth gate and session-expiry policy; the provider was only duplicating restore state.
- Decision: keep OAuth redirect entrypoints and callback recovery on the SDK client.
  - Rationale: SDK callback detection already runs at client construction and remains compatible with the upgraded contract.

## Risks / Trade-offs

- Removing the provider means the dashboard no longer gets generic auth state helpers from `@insforge/react`.
  - Mitigation: the app only used `isLoaded`, `isSignedIn`, and `signOut`, all of which are now repository-owned and directly testable.
- Session state is now restored only when the app loads or when repository-owned refresh paths run.
  - Mitigation: request retry and focus/visibility revalidate already use the repository-owned refresh helpers.
- Dependency removal changes dashboard lockfiles.
  - Mitigation: add guardrail tests that assert the dashboard runtime no longer depends on the React adapter packages.

## Deferred Follow-ups

- `cd dashboard && npm run build` still emits Vite large-chunk warnings for existing bundle size hotspots.
  - Status: non-blocking for this auth-restore fix because the production build succeeds and the warning predates the new restore boundary.
  - Follow-up: review chunk splitting and bundle shape in a separate performance-focused change.
- `npm run validate:copy` still reports existing unused copy keys.
  - Status: non-blocking for this auth-restore fix because `ci:local` passes and this change does not introduce new copy-registry violations.
  - Follow-up: prune or reconnect stale copy keys in a separate copy-registry cleanup change.
