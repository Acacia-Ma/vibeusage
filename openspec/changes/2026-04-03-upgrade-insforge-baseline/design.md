## Context

The repository uses official InsForge packages in two execution environments:

- root CLI/runtime: direct `@insforge/sdk` wrapper usage
- dashboard: `@insforge/sdk` plus `@insforge/react` and `@insforge/react-router`

These environments currently run on different SDK baselines. The dashboard also contains repository-local session refresh logic that exists partly because older SDK behavior returns stale local session state before performing official refresh recovery.

## Goals / Non-Goals

- Goals:
  - move the repository to one current official InsForge baseline
  - validate the combined root/dashboard contract on that baseline
  - diagnose token refresh using the new baseline as the only source of truth
  - avoid adding any new long-lived compatibility branch
- Non-Goals:
  - completing the final token-refresh fix in this change
  - redesigning dashboard UX
  - changing backend auth policy or token formats

## Invariants

- Invariant: root and dashboard MUST resolve the same `@insforge/sdk` version.
  - Why: split baselines make auth and session behavior impossible to reason about.
  - Signal: `package.json`, `dashboard/package.json`, and lockfiles all resolve to the same official SDK version.
- Invariant: repository call sites MUST converge toward official InsForge auth/session semantics, not preserve old local hacks.
  - Why: long-lived compatibility code would lock the repo to old-version bugs.
  - Signal: no new shim layer is introduced to emulate old session behavior.
- Invariant: refresh diagnosis MUST be performed only after the baseline upgrade lands.
  - Why: otherwise old-version defects contaminate the root-cause signal.
  - Signal: breakage inventory references the upgraded package graph.

## Boundary Matrix

Case | Preconditions | Input | Expected Output | Side Effects
--- | --- | --- | --- | ---
Root CLI wrapper | root SDK upgraded | CLI creates InsForge client for device-token flow | same auth boundary, no runtime import failure | root lockfile/version alignment
Dashboard auth restore | dashboard SDK/react stack upgraded | app loads with stored hosted-auth session | session restore behavior follows latest official contract | dashboard auth tests may need updates
Dashboard business request | upgraded baseline + authenticated dashboard | usage request receives auth failure | failure surface reflects new official contract; repository diagnosis can classify refresh conflict | no old-version-only retry assumptions remain hidden

## Decisions

- Decision: use the latest official package set as the repository baseline before making any refresh design decisions.
  - Rationale: this removes old-version ambiguity from the diagnosis.
- Decision: treat refresh-specific incompatibilities as follow-up diagnosis output unless they can be fixed while still converging on the latest official contract.
  - Rationale: today’s stopping point is upgrade + inventory, not full refresh remediation.
- Decision: create a new OpenSpec change instead of expanding `2026-01-19-update-dashboard-session-renewal`.
  - Rationale: the current task is repository-wide dependency and contract alignment, not only dashboard renewal behavior.

## Risks / Trade-offs

- Latest official packages may still be internally inconsistent across `sdk` and `react` adapters.
  - Mitigation: classify those as version-compatibility failures instead of masking them locally.
- Some existing tests may encode old-version implementation details.
  - Mitigation: update assertions only when the new official behavior is the new intended contract.
- Refresh remains unresolved after the upgrade.
  - Mitigation: explicitly record the narrowed root-cause surface and next fix location.

## Diagnosis Snapshot

### Version Compatibility

- The upgraded dashboard SDK exposes `auth.refreshSession()` and `auth.getCurrentUser()` but no longer exposes `auth.getCurrentSession()` in its public contract (`dashboard/node_modules/@insforge/sdk/dist/index.d.ts`).
- The latest installed React adapter still restores auth state via `this.sdk.auth.getCurrentSession()` (`dashboard/node_modules/@insforge/react/dist/index.js`), so the latest official `sdk/react` matrix is not internally aligned.

### Calling-Contract Changes

- The root CommonJS runtime can no longer rely on `require("@insforge/sdk")`; the upgraded package graph resolves into an ESM-only `@insforge/shared-schemas` dependency path in practice. Repository-owned CJS entrypoints were updated to use dynamic `import("@insforge/sdk")`.
- The dashboard SDK config no longer accepts a `storage` option. Repository-owned persistence now wraps the SDK token manager instead of passing custom storage through SDK config.

### Refresh Mechanism Conflicts

- The repository-local `clearSession()` + `getCurrentSession()` refresh trick was removed from `dashboard/src/lib/insforge-auth-client.ts`.
- Dashboard refresh now converges on the official `auth.refreshSession()` path, while current-session hydration rebuilds state from the token manager plus `auth.getCurrentUser()`.

### Unrelated Regressions

- The working tree still contains parallel OpenCode SQLite changes (`test/diagnostics.test.js`, `test/doctor.test.js`, `test/opencode-usage-audit.test.js`, `test/rollout-parser.test.js`, `test/status.test.js`, `test/sync-opencode-sqlite.test.js`, and `openspec/changes/2026-04-03-finalize-opencode-sqlite-support/`), but the final local verification run passed with those changes present.
- No unrelated repository-wide failure remains blocking this InsForge baseline upgrade.
