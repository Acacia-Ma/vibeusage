# PR Review Preflight

## Purpose

- Gate the PR body on a machine-checkable review contract.
- Keep the contract reusable across repositories by separating:
  - generic validator logic in `scripts/ops/pr-risk-layer-gate.cjs`
  - repo-specific machine contract in `scripts/ops/pr-risk-layer-gate.config.json`
- Separate four concerns explicitly:
  - permanent required sections
  - conditional required sections
  - optional reviewer context
  - machine-checked fields

## Contract Taxonomy

### Permanent required

These sections are required on every PR and are machine-checked:

- `What does this PR do?`
- `Type of Change`
- `Changes Made`
- `Affected Modules / Contracts`
- `Validation`
- `Risk Flags`

### Conditional required

These sections are required only when triggered by checked risk flags:

- `Risk Addendum (required if any risk flag is checked)`
  - `Rules / Invariants`
  - `Boundary Matrix (must list at least 3)`
  - `Evidence`
- `Public Exposure Addendum (required if public exposure is checked)`

### Optional reviewer context

These sections help reviewers but are not CI-blocking:

- `Reviewer Context (optional)`
- `Screenshots / Logs (optional)`

## Local Usage

1. Save the current PR body to a local Markdown file.
2. Run:

```bash
npm run review:preflight -- --body-file /absolute/path/to/pr-body.md --require-body
```

3. If the command fails, fix the PR body before requesting review.

## CI Body Source Precedence

In CI, the gate resolves the PR body in this order:

1. `--body`
2. `--body-file`
3. live GitHub API pull request body
4. `GITHUB_EVENT_PATH` payload fallback

Why this order matters:

- rerunning a workflow does not guarantee a refreshed event payload
- PR body edits after the original event can leave `GITHUB_EVENT_PATH` stale
- the live GitHub PR object is the actual review surface and therefore the correct CI source of truth

The gate emits diagnostics showing whether it used the live GitHub API or fell back to the event payload.

## Current VibeUsage Contract

- `Affected Modules / Contracts` remains required for every PR.
- Cross-module changes still need repo sitemap evidence.
- Any checked risk flag requires the risk addendum.
- The public exposure addendum is required only when the public exposure flag is checked.
- Reviewer context is optional and is not part of the hard gate.

## Reusable Contract

To reuse this flow in another repository:

1. Copy `scripts/ops/pr-risk-layer-gate.cjs`.
2. Create a repo-local config file like `scripts/ops/pr-risk-layer-gate.config.json`.
3. Point your package script at that config:

```bash
node scripts/ops/pr-risk-layer-gate.cjs --config scripts/ops/pr-risk-layer-gate.config.json
```

4. Align the PR template headings with the config.
5. Add a regression test that keeps the template, config, and trigger labels aligned.

## Common Failure Modes

- untouched template stubs in `Affected Modules / Contracts`
- checked risk flags without a complete risk addendum
- public exposure checked without a public exposure addendum
- stale event payload fallback after a GitHub API fetch failure
- missing required sections in `Validation`

## Review Loop

Use this order:

1. Finish implementation.
2. Run targeted tests and repo-local regression checks.
3. Run `npm run ci:local`.
4. Run `npm run review:preflight -- --body-file /absolute/path/to/pr-body.md --require-body`.
5. Request review.
6. If review returns issues, update code, tests, and any optional `Reviewer Context`, then repeat from step 2.
