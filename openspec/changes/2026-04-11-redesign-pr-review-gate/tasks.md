## 1. Contract redesign

- [x] 1.1 Replace the current mixed PR body taxonomy with explicit categories: permanent required, conditional required, optional reviewer context, and machine-checked fields.
- [x] 1.2 Remove `Codex Context` from the permanent machine contract and define its replacement fields in tool-agnostic language.
- [x] 1.3 Decide the final top-level template headings and conditional trigger labels.

## 2. Template and docs

- [x] 2.1 Rewrite `.github/PULL_REQUEST_TEMPLATE.md` to match the new taxonomy.
- [x] 2.2 Rewrite `docs/ops/pr-review-preflight.md` so it documents contract taxonomy, local preflight flow, CI body-source precedence, and common failure modes.
- [x] 2.3 Update `AGENTS.md` so repository workflow instructions refer to the new sections instead of `Codex Context`.

## 3. Gate config and runtime

- [x] 3.1 Rewrite `scripts/ops/pr-risk-layer-gate.config.json` so it is the single source of truth for required and conditional machine checks.
- [x] 3.2 Update `scripts/ops/pr-risk-layer-gate.cjs` to resolve PR body sources in the new priority order: explicit body, explicit body file, live GitHub API, event payload fallback.
- [x] 3.3 Add runtime diagnostics that show which body source was used and when fallback occurred.

## 4. Tests and verification

- [x] 4.1 Update `test/pr-risk-layer-gate.test.js` for the new headings and semantics.
- [x] 4.2 Add coverage for live API precedence, fallback behavior, stale event payload reruns, and optional reviewer context.
- [x] 4.3 Run targeted tests for the gate and then `npm run validate:pr-risk-layer` against representative sample bodies.
- [x] 4.4 Record the verification commands and results in the sample PR body used for local gate validation; copy them into the real PR `Validation` section when opening the PR.
