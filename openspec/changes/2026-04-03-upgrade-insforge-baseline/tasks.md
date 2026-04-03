## 1. Baseline Upgrade

- [x] 1.1 Align the root `@insforge/sdk` dependency to the latest official baseline.
- [x] 1.2 Align the dashboard official InsForge package set and refresh `dashboard/package-lock.json`.
- [x] 1.3 Confirm the resolved package graph matches the intended official baseline.

## 2. Repository Audit And Adaptation

- [x] 2.1 Audit CLI InsForge wrappers and device-token flows against the upgraded SDK contract.
- [x] 2.2 Audit dashboard auth/session restore, OAuth redirect, and request wrappers against the upgraded contract.
- [x] 2.3 Adapt repository call sites that break under the new official contract without adding long-lived compatibility shims.
- [x] 2.4 Update tests or assertions that intentionally pin old InsForge behavior/version strings.

## 3. Verification And Diagnosis

- [x] 3.1 Run the minimal auth baseline checks and record exact commands/results.
- [x] 3.2 Run repository-wide InsForge-related regressions and classify new failures.
- [x] 3.3 Produce the post-upgrade breakage inventory, explicitly separating:
  - version compatibility
  - calling-contract changes
  - refresh mechanism conflicts
  - unrelated regressions

## 4. Documentation

- [x] 4.1 Update the OpenSpec delta to reflect the official-baseline requirement.
- [x] 4.2 Record the refresh diagnosis on the upgraded baseline for follow-up work.
