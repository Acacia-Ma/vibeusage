# Change: Redesign PR template and PR body gate around a stable review contract

## Why

- The current PR template, CI gate config, and reviewer guidance have drifted out of alignment. The clearest mismatch is that the template says `Codex Context` is only required when requesting `@codex review`, while the machine gate treats it as unconditionally required.
- The current CI gate reads PR body content from `GITHUB_EVENT_PATH`, which can become stale on workflow reruns after the PR body is edited. That makes the gate validate an old snapshot instead of the live PR body that reviewers actually see.
- The current contract mixes four different concerns into one body structure: permanent author-supplied facts, conditional risk disclosures, reviewer-only context, and machine-checkable enforcement. This increases author burden and makes the gate brittle.
- We want to re-design the system from first principles using benchmarked external practice, then localize it to VibeUsage's repo-sitemap and risk-layer workflow.

## What Changes

- Define a new PR review contract that separates permanent required sections, conditional risk addenda, optional reviewer context, and machine-checked fields.
- Replace the current `Codex Context` hard gate with stable, tool-agnostic sections so reviewer context is no longer conflated with machine-required PR facts.
- Redesign the PR template around a contributor-friendly structure: summary, type, changed modules/contracts, validation, risk flags, conditional addenda, and optional reviewer context.
- Update the PR risk-layer gate to treat the GitHub PR object as the preferred body source in CI, with event payloads retained only as a fallback.
- Make the JSON gate config the single source of truth for machine-required sections and conditional rules, then align the template, docs, tests, and AGENTS workflow language to it.

## Impact

- Affected specs: `pr-review-gate` (new)
- Affected code: `.github/PULL_REQUEST_TEMPLATE.md`, `scripts/ops/pr-risk-layer-gate.cjs`, `scripts/ops/pr-risk-layer-gate.config.json`, `docs/ops/pr-review-preflight.md`, `test/pr-risk-layer-gate.test.js`, `AGENTS.md`, `.github/workflows/ci.yml`
- **BREAKING**: The existing `Codex Context` section name and unconditional hard requirement are removed. Existing PR author workflow must migrate to the new section taxonomy.

## Architecture / Flow

- Author fills a PR template that distinguishes:
  - permanent required facts for every PR
  - conditional addenda triggered by checked risk flags
  - optional reviewer context that helps re-review but is not CI-blocking
- Local preflight continues to support `--body` and `--body-file` for deterministic validation.
- CI validation resolves PR body sources in descending priority: explicit body input, explicit body file, live GitHub API pull request body, event payload fallback.
- The gate validates only stable machine contracts and conditional risk addenda. Reviewer-only context remains optional.

## Principles

- **Single source of truth:** the gate config defines the machine contract; the live GitHub PR object is the preferred body source in CI.
- **First principles:** gate what is stable, high-signal, and materially useful; do not hard-block reviewer-only prose.
- **No backward compatibility:** do not preserve misleading section names or semantics just to avoid template churn.
- **Atomic commits:** land docs/spec, template+config, gate runtime, and tests in separate commits.

## Risks & Mitigations

- Risk: reviewer workflow confusion during transition.
  - Mitigation: update `docs/ops/pr-review-preflight.md` and `AGENTS.md` in the same change and explain the new taxonomy explicitly.
- Risk: live GitHub API fetch can fail due to token or network issues.
  - Mitigation: keep event payload fallback, surface body-source diagnostics in logs, and fail only when no valid body source exists or the contract is actually violated.
- Risk: new template still drifts from config over time.
  - Mitigation: extend tests so template headings, conditional triggers, and non-gated optional sections stay aligned with config semantics.

## Rollout / Milestones

- M1 Benchmark external PR template / gate patterns and codify the new contract taxonomy.
- M2 Rewrite template, config, and reviewer docs around the new contract.
- M3 Implement live-body-first gate resolution and improved diagnostics.
- M4 Update tests and workflow docs; verify local and CI behavior against stale-payload and conditional-risk scenarios.
