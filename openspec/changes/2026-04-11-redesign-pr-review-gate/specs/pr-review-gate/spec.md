## ADDED Requirements

### Requirement: PR body contract taxonomy

The system SHALL define the PR body contract using four explicit categories: permanent required sections, conditional required sections, optional reviewer context, and machine-checked fields.

#### Scenario: Reviewer context is not part of the hard gate

- **WHEN** a pull request omits optional reviewer context
- **THEN** the PR body gate SHALL still pass as long as all required and triggered conditional sections are complete
- **AND** the repository documentation SHALL describe reviewer context as optional

#### Scenario: Machine contract is stable and tool-agnostic

- **WHEN** the PR body gate evaluates the template contract
- **THEN** it SHALL validate stable section semantics such as summary, changed modules/contracts, validation evidence, and risk disclosures
- **AND** it SHALL NOT require a reviewer-tool-specific section name such as `Codex Context`

### Requirement: Conditional risk addenda

The system SHALL require additional PR body sections only when the corresponding risk flags are triggered.

#### Scenario: Generic risk addendum required

- **WHEN** any risk flag is checked in the PR body
- **THEN** the PR SHALL include `Rules / Invariants`, `Boundary Matrix`, and `Evidence`
- **AND** the gate SHALL fail if any of those triggered sections is missing or left as a placeholder

#### Scenario: Public exposure addendum required only when applicable

- **WHEN** the `Public exposure / share links / unauthenticated access` risk flag is checked
- **THEN** the PR SHALL include a public-exposure-specific addendum describing access rules, exposed fields, media/avatar policy, and regression coverage
- **AND** the gate SHALL NOT require that addendum for PRs that do not trigger public exposure review

### Requirement: Live PR body source in CI

The system SHALL prefer the live GitHub pull request body over historical event payload snapshots when validating PR bodies in CI.

#### Scenario: Rerun after PR body edit

- **WHEN** a pull request body is edited after the original workflow event and CI is rerun
- **THEN** the gate SHALL validate the current live PR body from the GitHub API when credentials and PR context are available
- **AND** the gate SHALL NOT depend on a new push solely to refresh the event payload body

#### Scenario: Event payload fallback

- **WHEN** the live GitHub API body cannot be fetched
- **THEN** the gate SHALL fall back to the event payload body if available
- **AND** the runtime output SHALL indicate that fallback was used

### Requirement: Gate config as machine source of truth

The system SHALL keep the machine-enforced PR body contract in the gate config and SHALL keep the PR template and tests aligned with it.

#### Scenario: Template and config stay aligned

- **WHEN** the repository updates required headings, trigger labels, or conditional addenda
- **THEN** the gate config, PR template, and regression tests SHALL be updated together
- **AND** CI SHALL fail if the template no longer reflects the configured machine contract
