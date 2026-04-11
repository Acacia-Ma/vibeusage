# Design: PR template and PR body gate redesign

## Context

This redesign is driven by a mismatch between author intent, reviewer workflow, and machine enforcement:

- The current template presents `Codex Context` as conditional reviewer context.
- The current gate config treats it as unconditionally required.
- The current CI runtime prefers `GITHUB_EVENT_PATH`, which is a historical event snapshot and can remain stale across reruns.

We benchmarked strong external repositories before proposing a localized redesign:

- **Hermes Agent**: contributor-friendly summary + testing + checklists; reviewer help is not over-gated.
- **Kubernetes**: strong separation between reviewer notes and machine-consumable structured blocks such as release notes.
- **Angular**: clean split between always-required sections and conditional sections such as breaking changes.
- **Storybook**: clear distinction between contributor fields, maintainer-only sections, and machine-mutated markers.
- **LangChain**: uses workflow/policy checks for some constraints instead of forcing every concern into the PR body.

The localized VibeUsage requirement is to preserve repo-specific contract quality around:

- changed modules and dependency/contracts touched
- repo sitemap evidence
- risk-layer triggers
- cross-boundary invariants
- public-exposure review when applicable

## Goals

- Produce a PR template that is easy for authors to fill and easy for reviewers to scan.
- Make machine enforcement cover only stable, high-signal fields.
- Make conditional risk review first-class and explicit.
- Treat the live GitHub PR body as the CI truth source.
- Remove tool-specific wording from the core contract.

## Non-Goals

- Do not preserve the existing `Codex Context` section name for compatibility.
- Do not make optional reviewer context machine-blocking.
- Do not rely on push-only event refresh as a workaround for stale PR body validation.
- Do not add new external runtime dependencies if the GitHub API call can be made with built-in Node APIs.

## Contract Taxonomy

### 1. Permanent required sections

These apply to every PR and are suitable for machine validation:

- `What does this PR do?`
- `Type of Change`
- `Changes Made`
- `Affected Modules / Contracts`
- `Validation`
- `Risk Flags`

### 2. Conditional required sections

These are required only when the corresponding trigger is checked:

- `Risk Addendum`
  - `Rules / Invariants`
  - `Boundary Matrix`
  - `Evidence`
- `Public Exposure Addendum`
  - required only when the public exposure flag is checked

### 3. Optional reviewer context

These help humans or AI reviewers but are not CI-gated:

- `Reviewer Context`
  - review focus
  - delta since last review
  - dependencies / review ordering
  - known gaps / follow-ups
- screenshots / logs

### 4. Machine-checked vs non-checked

Machine-checked:

- required section headings exist
- required sections are non-empty and not untouched stubs
- checked risk flags require the corresponding addendum
- `Boundary Matrix` contains at least three bullets

Not machine-checked:

- prose quality
- screenshot presence
- optional reviewer context completeness
- whether the author used a specific AI reviewer

## Template Design

The template SHALL be reorganized into this top-level flow:

1. `What does this PR do?`
2. `Related Issue`
3. `Type of Change`
4. `Changes Made`
5. `Affected Modules / Contracts`
6. `Validation`
7. `Risk Flags`
8. `Risk Addendum (required if any risk flag is checked)`
9. `Public Exposure Addendum (required if public exposure is checked)`
10. `Reviewer Context (optional)`
11. `Screenshots / Logs (optional)`

This structure keeps contributor-facing information near the top, moves risk disclosures into explicit conditionals, and demotes re-review notes to optional reviewer context.

## Gate Config Design

The JSON config becomes the machine contract source of truth.

It SHALL define:

- placeholder values and untouched stub markers
- required top-level sections
- conditional rules keyed by trigger section and checked labels
- minimum content constraints such as bullet counts

It SHALL NOT encode reviewer-tool-specific names like `Codex Context` in the permanent contract.

## CI Body Source Resolution

The gate SHALL resolve the PR body in this priority order:

1. `--body`
2. `--body-file`
3. live GitHub API fetch of the pull request body
4. `GITHUB_EVENT_PATH` payload fallback
5. null

### Why live API first in CI

The body being reviewed is the current PR object on GitHub, not the historical event payload that triggered a previous run. On rerun, `GITHUB_EVENT_PATH` can remain stale after the PR body is edited. Using the live API first restores single-source-of-truth behavior.

### Live API fetch requirements

The gate runtime SHALL:

- derive repository and PR number from GitHub Actions environment or event payload
- use `GITHUB_TOKEN` for authentication when available
- emit body-source diagnostics that identify whether the body came from explicit input, live API, or event payload fallback
- continue with event fallback if the API fetch fails

## Alternatives Considered

### Alternative A: Keep `Codex Context`, but make it truly conditional

Rejected as the primary design.

Pros:

- minimal wording churn for current users
- preserves familiar section name

Cons:

- still binds a stable workflow contract to one reviewer/tool brand
- requires an additional trigger source to know whether `@codex review` was requested
- preserves a mixed semantic bucket instead of separating permanent facts from reviewer-only context

### Alternative B: Keep current template and only fix stale body reads

Rejected.

Pros:

- smallest code diff

Cons:

- does not resolve contract taxonomy problems
- leaves template/config/docs semantic drift intact
- continues to hard-gate reviewer-loop prose that should remain optional

## Testing Strategy

The updated test suite SHALL cover:

- template/config alignment for required sections and conditional triggers
- reviewer context being optional and not enforced
- risk addendum required when any risk flag is checked
- public exposure addendum required only for public exposure
- live API body preferred over event payload when both are available
- event payload fallback when live API is unavailable
- stale event payload rerun scenario
- empty body producing validation failure instead of silent skip when a PR context exists

## Rollout Notes

This redesign should land in the following order:

1. proposal + design + task checklist
2. template + config + docs alignment
3. gate runtime source-resolution update
4. test updates and CI verification
