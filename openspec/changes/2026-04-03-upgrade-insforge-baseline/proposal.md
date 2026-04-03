# Change: Upgrade repository InsForge baseline to the latest official stack

## Why

The repository currently runs mixed official InsForge package baselines: the root CLI depends on `@insforge/sdk@^1.0.4`, while the dashboard depends on `@insforge/sdk@^1.1.5`, `@insforge/react@1.1.8`, and `@insforge/react-router@1.1.7`. This violates the stable spec requirement that root and dashboard pin the same SDK version, and it makes session-refresh behavior hard to diagnose because repository-local workarounds are compensating for old package contracts.

We need to move the repository to the latest official InsForge baseline first, then diagnose token refresh behavior on that baseline instead of extending old-version compatibility logic.

## What Changes

- Upgrade the root and dashboard `@insforge/sdk` dependency to the latest official baseline (`1.2.2`).
- Keep the dashboard React adapters on the latest official releases (`@insforge/react@1.1.8`, `@insforge/react-router@1.1.7`) and validate the combined contract.
- Audit every repository InsForge call site affected by the new SDK baseline:
  - CLI wrappers and device-token flows
  - dashboard auth/session restore
  - dashboard SDK wrapper and request helpers
  - repo tests, smoke scripts, and dependency assertions
- Remove repository-local behavior that only exists to preserve old SDK session semantics when the latest official contract already supersedes it.
- Record the post-upgrade breakage inventory and isolate refresh-specific failures from unrelated upgrade fallout.

## Impact

- Affected specs: `openspec/specs/vibeusage-tracker/spec.md`
- Affected code:
  - `package.json`
  - `dashboard/package.json`
  - `src/lib/insforge-client.js`
  - `dashboard/src/lib/insforge-client.ts`
  - `dashboard/src/lib/insforge-auth-client.ts`
  - `dashboard/src/lib/vibeusage-api.ts`
  - `dashboard/src/App.jsx`
  - repo tests and smoke scripts that assert InsForge package/version behavior
- Risks:
  - auth/session restore behavior may change under the new SDK contract
  - dashboard React adapters may still encode older session assumptions
  - refresh-specific regressions may be exposed only after the baseline upgrade
