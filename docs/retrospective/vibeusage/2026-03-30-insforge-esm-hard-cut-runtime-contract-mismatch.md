---
repo: vibeusage
layer: backend
module: insforge-esm-runtime-contract
severity: S1
design_mismatch: yes
detection_gap: yes
reusable_for:
  - insforge
  - edge-functions
  - esm-hard-cut
  - runtime-contract
  - release-provenance
  - deploy-smoke
owner: Victor
status: mitigated
report_date: 2026-03-30
incident_window: 2026-03-29..2026-03-29
---

# Postmortem: Insforge ESM Hard Cut Runtime Contract Mismatch

## L2 Brief (2 min)

- **What happened:** The remaining `vibeusage-*` functions were hard-cut to the ESM-only author/build/load contract, but the generated artifacts assumed Insforge would inject `globalThis.createClient`. Live runtime did not inject it, so touched endpoints failed until the runtime contract was corrected and the fleet was re-deployed.
- **Why design mismatch happened:** We replaced the official SDK-import contract with an inferred global-injection contract without proving that contract in the target runtime first.
- **Why not detected early:** Local build and repository checks proved the repo contract, but not the live runtime contract. The first diagnosis over-weighted provider-side `BOOT_FAILURE` instead of separating ESM boot, injected globals, and SDK import as distinct hypotheses.
- **What fixed it:** Minimal live probes proved ESM boot was fine, `globalThis.createClient` was absent, and `npm:@insforge/sdk` worked. The build banner was restored to inject the SDK into artifacts, the shared client loader got an explicit SDK fallback, and all 28 live `vibeusage-*` slugs were redeployed from merged `main`.
- **When to read this next time:** Any change to edge runtime contract, generated deploy artifacts, or any release where live function deployment happens before merge provenance is pinned to `main`.

## 1. Scope

- In scope:
  - `insforge-src/functions-esm/` hard cut and generated `insforge-functions/*.js` artifacts.
  - Shared edge client loading contract.
  - Insforge live deployment and runtime validation.
  - Release provenance and freeze closure for manual MCP deploys.
- Out of scope:
  - Business logic inside individual usage endpoints.
  - Dashboard/frontend rendering.
  - Database schema or aggregation semantics.
- Time window:
  - 2026-03-29 -> 2026-03-29

## 2. Plan Before Incident

- Intended outcomes:
  - Remove the legacy CJS author path entirely.
  - Standardize source, build, load, deploy, and docs on one ESM contract.
  - Deploy the migrated functions and prove live behavior with smoke checks.
- Planned milestones:
  - 2026-03-29: merge remaining legacy function migration.
  - 2026-03-29: deploy migrated fleet and capture freeze evidence.
  - 2026-03-29: close with CI + release gates green.
- Key assumptions:
  - The runtime would provide `globalThis.createClient` for generated artifacts.
  - If live deployment failed, the likely cause would be provider boot/runtime issues.
  - A successful pre-merge live deployment was operationally sufficient until final merge provenance was revisited.

## 3. Outcome vs Plan

- What shipped:
  - The legacy author path was removed.
  - Remaining functions and ingest dependencies moved to ESM-only sources.
  - Build/load/test/docs were unified to the new contract.
  - The runtime contract then had to be corrected and the live fleet redeployed.
- Deviations/gaps:
  - The first hard-cut deploy used an unproven `globalThis.createClient` contract.
  - Live validation initially conflated runtime bootstrap failure with provider-side failure.
  - Release provenance needed one extra closure loop to re-pin the live deploy to merged `main`.
- Metric deltas:
  - Local gates passed on the first pass: `openspec validate`, `build:insforge`, `build:insforge:check`, `ci:local`.
  - Live application-layer smoke passed only after the runtime contract fix:
    - `usage-summary` -> `401 Unauthorized`
    - `link-code-exchange` -> `400 {"error":"invalid link code"}`
    - `sync-ping` -> `401 Missing bearer token`
    - `leaderboard-profile` -> `404 Not found`

## 4. Impact

- User/customer impact:
  - During the initial hard-cut rollout window, touched endpoints could fail at startup/runtime instead of returning normal application-layer responses.
  - No evidence was found of silent data corruption; this was availability/closure risk, not integrity drift.
- Business/ops impact:
  - Release closure was delayed by an extra diagnosis and redeploy loop.
  - The team spent time proving runtime assumptions in production instead of only verifying business behavior.
- Duration:
  - Same-day rollout window on 2026-03-29, from the first hard-cut live deploy until the runtime contract fix and full fleet redeploy completed.

## 5. Timeline

- Detection:
  - 2026-03-29: post-hard-cut live deploy reported `BOOT_FAILURE` and real endpoint calls surfaced `Missing createClient`.
- Mitigation:
  - 2026-03-29: deployed minimal probe functions to isolate three questions separately: ESM boot, injected global availability, and official SDK import viability.
  - 2026-03-29: confirmed ESM boot was valid, `globalThis.createClient` was not injected, and `npm:@insforge/sdk` worked.
- Resolution:
  - 2026-03-29: restored the SDK-based runtime contract in generated artifacts and shared client loading.
  - 2026-03-29: redeployed all 28 live `vibeusage-*` slugs and re-ran live smoke.
  - 2026-03-29: re-pinned release provenance by redeploying from merged `main` and recording the final SHA in freeze.

## 6. Evidence

- PR and merge:
  - PR [#119](https://github.com/victorGPT/vibeusage/pull/119)
  - merged source commit `508a6a705b3a441814dd1815b487917b0d19cb3e`
- Key commits:
  - `fff88d70` `refactor remaining edge functions to esm-only contract`
  - `2e780103` `align esm hard-cut docs and runtime contract`
  - `5c42abdd` `Fix Insforge ESM client loading`
  - `508a6a70` `fix insforge runtime contract for esm artifacts`
  - `0328dd0a` `record main-based insforge redeploy provenance`
- Spec/task evidence:
  - `openspec/changes/2026-03-29-refactor-remaining-edge-functions-esm-hard-cut/tasks.md`
- Deploy/runtime evidence:
  - `docs/deployment/freeze.md`
  - Live probes recorded there show:
    - ESM noop boot succeeded.
    - `globalThis.createClient` was `undefined`.
    - `npm:@insforge/sdk` import path worked.
    - banner-injected artifacts matched the live contract.
- Verification evidence:
  - `openspec validate 2026-03-29-refactor-remaining-edge-functions-esm-hard-cut --strict`
  - `npm run build:insforge:check`
  - `npm run ci:local`
  - GitHub Actions `Release` run `23709004784` completed `success`.

## 7. Root Causes

- Primary cause:
  - We changed the production runtime contract from “explicit SDK import” to “runtime-injected global” based on inference, not on official docs or a live probe.
  - Stage (Primary): Design
  - Stage (Secondary): Release/Integration
  - Identified date: 2026-03-29
  - Evidence:
    - `2e780103` removed the generated SDK banner while the live probes later proved the runtime did not inject `globalThis.createClient`.
    - `508a6a70` restored the SDK banner contract after the probes invalidated the assumption.

- Secondary cause:
  - We did not require a minimal live runtime contract matrix before diagnosing the failure as provider-side `BOOT_FAILURE`.
  - Stage (Primary): Testing
  - Stage (Secondary): Review Packaging
  - Identified date: 2026-03-29
  - Evidence:
    - Local verification in OpenSpec task 2.x and `ci:local` passed, but none of those checks proved injected globals in the target runtime.
    - The probe sequence in `docs/deployment/freeze.md` was what actually separated “ESM boot works” from “injected global does not exist”.

- Tertiary cause:
  - We treated “live deploy from a branch, then merge later” as good enough until the user re-raised provenance and forced the final `main`-pinned redeploy.
  - Stage (Primary): Release/Integration
  - Stage (Secondary): Design
  - Identified date: 2026-03-29
  - Evidence:
    - `0328dd0a` exists solely to pin the final live redeploy to merged `main` in `docs/deployment/freeze.md`.

## 8. Action Items

- [ ] Add a regression that fails if generated Insforge artifacts lose the official `npm:@insforge/sdk` banner needed by the runtime contract. (Owner: Victor, Due 2026-04-02)
- [ ] Add a release probe runbook for runtime-contract changes: ESM noop, global-injection check, official SDK import, and at least one real endpoint smoke. (Owner: Victor, Due 2026-04-02)
- [ ] Update release closure rules so any pre-merge live deploy must either be repeated from merged `main` or explicitly record SHA-equivalence proof before closure. (Owner: Victor, Due 2026-04-02)
- [ ] Add a review-packaging checklist item for runtime contract changes: “official docs vs repo assumption vs live probe” must be explicit before merge. (Owner: Victor, Due 2026-04-03)

## 9. Prevention Rules

- Rule 1:
  - Runtime contract changes must start from one of two authoritative sources: official platform docs or a live probe in the target runtime. Inferred globals are not an acceptable source of truth.
  - Enforcement:
    - No closure for runtime-contract changes without either doc-backed contract notes or probe evidence in freeze/spec.
  - Verification:
    - Freeze entry contains probe or doc evidence.

- Rule 2:
  - If generated artifacts depend on runtime-provided globals, tests must prove those globals exist in the target runtime. Otherwise the artifact must self-supply the dependency.
  - Enforcement:
    - Artifact regression coverage must fail when the SDK banner is removed without replacement.
  - Verification:
    - `node --test test/insforge-esm-artifacts.test.js test/edge-functions.test.js`
    - live smoke returns application-layer responses instead of startup/runtime failures.

- Rule 3:
  - Release provenance is incomplete until the deployed source is pinned to the merged `main` SHA for manual MCP deploys.
  - Enforcement:
    - `docs/deployment/freeze.md` must record the final merged SHA for the live deploy source.
  - Verification:
    - freeze entry and `Release` workflow both show final closure from the merged source.

## 10. Follow-up

- Checkpoint date:
  - 2026-04-03
- Success criteria:
  - Future edge runtime-contract changes include a probe matrix before provider blame is assigned.
  - Artifact tests guard the SDK banner/runtime dependency contract.
  - Manual Insforge deploys cannot be marked closed until freeze records the merged `main` SHA.
