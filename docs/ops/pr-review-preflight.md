# PR Review Preflight

## Purpose

- Gate `@codex review` behind a machine-checkable PR body contract.
- Keep the contract reusable across repositories by separating:
  - generic validator logic in `scripts/ops/pr-risk-layer-gate.cjs`
  - repo-specific requirements in `scripts/ops/pr-risk-layer-gate.config.json`

## Local Usage

1. Save the current PR body to a local Markdown file.
2. Run:

```bash
npm run review:preflight -- --body-file /absolute/path/to/pr-body.md --require-body
```

3. If the command fails, fix the PR body before requesting `@codex review`.

## CI Usage

- `CI` runs `npm run validate:pr-risk-layer` on pull requests.
- The script reads `GITHUB_EVENT_PATH` automatically and validates `pull_request.body`.
- Push builds without a PR body skip this check.

## Reusable Contract

To reuse this flow in another repository:

1. Copy `scripts/ops/pr-risk-layer-gate.cjs`.
2. Create a repo-local config file like `scripts/ops/pr-risk-layer-gate.config.json`.
3. Point your package script at that config:

```bash
node scripts/ops/pr-risk-layer-gate.cjs --config scripts/ops/pr-risk-layer-gate.config.json
```

4. Align the PR template headings with the config.
5. Add a regression test that ensures the config and template stay aligned.

## Current VibeUsage Contract

- Required sections:
  - `Affected Modules / Dependency Notes`
  - `Codex Context (required when requesting @codex review)`
- Conditional gate:
  - if any item in `Risk Layer Trigger (if any)` is checked,
  - then `Rules / Invariants`, `Boundary Matrix (must list at least 3)`, and `Evidence (tests or repro)` must be filled.

## Review Loop

Use this order:

1. Finish implementation.
2. Run targeted tests and repo-local regression checks.
3. Run `npm run ci:local`.
4. Run `npm run review:preflight -- --body-file /absolute/path/to/pr-body.md --require-body`.
5. Request `@codex review`.
6. If review returns issues, update code, tests, and `Codex Context`, then repeat from step 2.
