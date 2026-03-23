# Dashboard Identity SSOT Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the dashboard current-user identity resolve exclusively from the authenticated user's backend profile, eliminating session/redirect display-name drift.

**Architecture:** Keep auth session recovery focused on authentication state (`accessToken`, `userId`), add a single profile-backed identity resolver in the dashboard, and migrate all dashboard identity reads to that resolver. Remove redirect `name` transport so display identity never comes from URL state.

**Tech Stack:** React 18, Vite, Vitest, InsForge SDK, OpenSpec

---

### Task 1: Lock the identity resolver contract with failing tests

**Files:**
- Modify: `dashboard/src/lib/__tests__/insforge-auth-client.test.ts`
- Create: `dashboard/src/lib/__tests__/current-identity.test.ts`
- Test: `dashboard/src/lib/__tests__/insforge-auth-client.test.ts`, `dashboard/src/lib/__tests__/current-identity.test.ts`

**Step 1: Write the failing tests**

- Add a resolver test that starts with a valid `accessToken + userId` session and missing display name, then expects profile hydration to produce `displayName`.
- Add a resolver test that starts with a valid session and a stale `session.user.name`, then expects profile to win.
- Add a resolver test that expects the anonymous fallback only when profile `name` is absent.

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/__tests__/insforge-auth-client.test.ts src/lib/__tests__/current-identity.test.ts`
Expected: FAIL because no centralized current-identity resolver exists and stale session names are still allowed to drive UI display.

**Step 3: Write minimal implementation**

- Add `dashboard/src/lib/current-identity.ts` (or equivalent) with one exported resolver that accepts authenticated session input and returns `{ userId, displayName, avatarUrl }`.
- Keep anonymous fallback inside this resolver only.

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/__tests__/insforge-auth-client.test.ts src/lib/__tests__/current-identity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add dashboard/src/lib/current-identity.ts dashboard/src/lib/__tests__/insforge-auth-client.test.ts dashboard/src/lib/__tests__/current-identity.test.ts
git commit -m "refactor(dashboard): centralize current identity resolution"
```

### Task 2: Migrate dashboard identity consumers to the resolver

**Files:**
- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/pages/DashboardPage.jsx`
- Modify: `dashboard/src/ui/matrix-a/views/DashboardView.jsx`
- Test: `dashboard/src/pages/__tests__/DashboardPage.identity.test.jsx`

**Step 1: Write the failing test**

- Add a dashboard test that renders the signed-in dashboard and expects the identity card to read from the centralized resolver instead of `auth.name`.
- Add a regression that proves a stale or missing `auth.name` no longer forces `ANONYMOUS` when profile data exists.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/__tests__/DashboardPage.identity.test.jsx`
Expected: FAIL because `DashboardPage` still derives identity from `auth.name`.

**Step 3: Write minimal implementation**

- Wire `App.jsx` to resolve and cache current identity after auth recovery.
- Pass resolved identity through to `DashboardPage`.
- Remove current-user display derivation from `auth.name` in `DashboardPage`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/__tests__/DashboardPage.identity.test.jsx`
Expected: PASS

**Step 5: Commit**

```bash
git add dashboard/src/App.jsx dashboard/src/pages/DashboardPage.jsx dashboard/src/ui/matrix-a/views/DashboardView.jsx dashboard/src/pages/__tests__/DashboardPage.identity.test.jsx
git commit -m "refactor(dashboard): use profile-backed current identity"
```

### Task 3: Remove redirect display identity transport

**Files:**
- Modify: `dashboard/src/lib/auth-redirect.ts`
- Modify: `dashboard/src/lib/__tests__/auth-redirect.test.ts`
- Test: `dashboard/src/lib/__tests__/auth-redirect.test.ts`

**Step 1: Write the failing test**

- Add a redirect test asserting that loopback redirect URLs omit `name`.
- Add a regression test proving downstream dashboard identity still resolves from profile after auth redirect.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/auth-redirect.test.ts`
Expected: FAIL because redirect payloads still include `name`.

**Step 3: Write minimal implementation**

- Remove `name` handling from `buildRedirectUrl`.
- Remove dependent display logic that assumes redirect-carried display name exists.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/auth-redirect.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add dashboard/src/lib/auth-redirect.ts dashboard/src/lib/__tests__/auth-redirect.test.ts
git commit -m "refactor(auth): remove redirect identity payload"
```

### Task 4: Run focused regression and record evidence

**Files:**
- Modify: `openspec/changes/2026-03-23-refactor-dashboard-identity-ssot/tasks.md`

**Step 1: Run focused regression**

Run: `npm test -- src/lib/__tests__/insforge-auth-client.test.ts src/lib/__tests__/current-identity.test.ts src/pages/__tests__/DashboardPage.identity.test.jsx src/lib/__tests__/auth-redirect.test.ts`
Expected: PASS

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Update task checklist**

- Mark completed tasks in `openspec/changes/2026-03-23-refactor-dashboard-identity-ssot/tasks.md`.

**Step 4: Commit**

```bash
git add openspec/changes/2026-03-23-refactor-dashboard-identity-ssot/tasks.md
git commit -m "docs(openspec): record dashboard identity ssot verification"
```
