# vibeusage v3 finishing tasks — Ralph Loop

You are continuing work on the vibeusage dashboard v3 visual refactor. The
core v3 system, the shadcn retro-fit pipeline (`tooltip` + `dialog`
already verified), and the SSOT guardrail are all in place. Six tasks
remain. Each iteration: read this prompt, check git log + the existing
task list (#15-#20, T1..T6) for the next incomplete task, finish it
end-to-end, commit on the feature branch (do NOT push to `main`).

When all six tasks are committed and the PR is open + CI green, output
exactly:

`<promise>ALL_TASKS_COMPLETE</promise>`

## Branch + ship policy (READ FIRST — diverges from prior in-session habits)

This loop runs autonomously. AGENTS.md ships two non-negotiable rules:

1. **No `git push` to `main` without explicit user instruction.** Ralph is
   not explicit user instruction. Push only to a feature branch.
2. **PR + CI mandatory before "release" / merge.** Direct `git push origin
   main` is forbidden for non-trivial work. Open a PR, wait for CI green,
   surface the URL. The human merges.

Concrete workflow:

- **First iteration only:** create branch `feat/v3-finishing` from
  current `origin/main` (verify branch doesn't already exist; if it
  does, check it out and continue on it).
  ```
  git fetch origin main
  git checkout -B feat/v3-finishing origin/main
  ```
- **Every task commit:** `git commit` on `feat/v3-finishing`. Do NOT
  `git push` until T6.
- **T6 only:** push branch `git push -u origin feat/v3-finishing`,
  open PR via `gh pr create` against `main` using AGENTS.md's PR
  template fields, wait for CI to go green, capture PR URL.

## Universal constraints (apply to every task)

1. **DESIGN.md SSOT.** No forbidden tokens. Run
   `cd dashboard && npm run guardrail:design` after every code change.
2. **Copy registry.** All visible UI text comes from
   `dashboard/src/content/copy.csv` per `AGENTS.md`. No hardcoded
   strings introduced.
3. **shadcn pipeline.** New shadcn components: copy upstream into
   `dashboard/src/ui/shadcn/<name>.tsx`, run
   `node dashboard/scripts/shadcn-retro-fit.mjs dashboard/src/ui/shadcn/<name>.tsx`,
   verify idempotent with `--check`, then `npm run guardrail:design`.
4. **Pre-commit validate (per task).** Before EVERY commit, all must
   exit 0:
   ```
   cd dashboard
   npm run guardrail:design
   npx tsc --noEmit
   npx vitest run --reporter=basic
   cd ..
   npm run validate:ui-hardcode
   npm run validate:copy
   ```
5. **One task = one commit on the feature branch.** Subject prefix:
   `feat`/`fix`/`refactor`/`chore`. NO `git push` until T6.
6. **Codex stop-time hook.** If it flags issues, fix in the SAME
   iteration. Never commit known-broken state.
7. **No new shadcn deps.** `tooltip` + `dialog` are enough for T2/T3.
   If a task seems to need another shadcn component, surface as
   blocker — do NOT auto-install.

## Tasks (do in order, mark TaskList #15-#20 in-progress / completed)

### T1 — katakana band in MatrixShell header  (TaskList #15)

The v3-1 commit added `system.header.katakana_deco` to
`SystemHeader.jsx` but that component is not on the main dashboard
route, so the band never renders in production. Move it to
`dashboard/src/ui/foundation/MatrixShell.jsx` header so it appears on
every shell-based page. Use the **existing copy key**
(`copy("system.header.katakana_deco")`), no new csv entries. Place
it in the header's middle / right slot, class
`deco-katakana hidden md:inline text-micro`, `aria-hidden="true"`.

### T2 — KeyboardCheatsheet → shadcn Dialog  (TaskList #16)

Rewrite `dashboard/src/ui/matrix-a/components/KeyboardCheatsheet.jsx`
to consume `dashboard/src/ui/shadcn/dialog.tsx`. Delete the
hand-rolled `handleDialogKeyDown` Tab trap, `closeButtonRef` initial-
focus dance, and `previouslyFocused` restore — base-ui Dialog handles
these natively.

Preserve:
- `KEY_ROWS` content + visual layout
- All `keyboard.cheatsheet.*` copy keys
- `?` keybind toggling open (in `useGlobalKeybinds` / `DashboardPage`)
- `screenshotMode` suppression (`enabled: booted && !screenshotMode`)
- Esc closes (now via Dialog)
- Backdrop click closes (now via Dialog)

Visual constraint: dialog body should still look like the current
"keymap.help" panel — `text-heading text-ink uppercase tracking-label`
title, KBD-styled key cells, `text-ink-text uppercase text-caption`
descriptions, footer note. Wrap Dialog content with `font-mono` plus
the same border/padding so v3 look is preserved.

### T3 — CostAnalysisModal → shadcn Dialog  (TaskList #17)

Migrate `dashboard/src/ui/matrix-a/components/CostAnalysisModal.jsx`
(currently ~5KB hand-rolled modal) to consume shadcn Dialog. Keep the
prop contract (`open` / `onClose`), the same body content + copy
keys, and the v3 visual feel. The consumption site
(`DashboardPage.jsx` / `DashboardView.jsx`) should not need to change.

### T4 — Re-capture docs/screenshots  (TaskList #18)

Regenerate `docs/screenshots/dashboard.png`, `landing.png`,
`wrapped-2025.png` against current dev render. Use:
```
cd dashboard
npm run screenshot
```
Script (`scripts/capture-dashboard-screenshot.mjs`) may need dev
server up — start it in background first if so. Verify the 3 PNGs
visually contain v3 elements: 96px hero number, double-line ╔═╗ ╚═╝
primary frame on the hero panel, katakana band in the header (visible
after T1), `< ¬‿¬ > // observing` mascot in footer. Commit only the
regenerated PNGs.

### T5 — Mobile bolder pass  (TaskList #19)

Three surgical mobile improvements at `< md` breakpoint:

1. **Hero number weight on mobile.** Audit smaller metric numbers in
   `dashboard/src/ui/matrix-a/components/UsagePanel.jsx`'s
   `metricsRows` block — bump anything currently `text-body` /
   `text-data` for hero-tier metrics up to at least `text-display-3`
   so v3 weight carries to small screens.
2. **fx-crt mobile dampen.** In `dashboard/src/styles.css`, add a
   `@media (max-width: 767px) .fx-crt { ... }` block dropping the
   inset phosphor warmth from `rgba(0,255,65,0.04)` to
   `rgba(0,255,65,0.025)` (≈25% softer). Outer black inset stays.
3. **Period switcher overflow.** Audit
   `dashboard/src/ui/matrix-a/components/UsagePanel.jsx` period tab
   row (DAY/WEEK/MONTH/TOTAL `<Button>` mapped from `tabs`). On
   mobile this can wrap or overflow — wrap the row in a
   `<div className="overflow-x-auto no-scrollbar">` and ensure the
   inner row uses `flex` (not `flex-wrap`).

### T6 — Final validate + open PR + CI green + ship  (TaskList #20)

This task's exit criterion is the `<promise>` — be careful.

a. Run full validate suite (per Universal #4). All must exit 0.
   Also run `npm run ci:local` from project root (per AGENTS.md
   release rule). All exit 0 required.

b. Verify `git log --oneline -10` shows T1..T5 commits in order on
   `feat/v3-finishing`.

c. Push branch:
   ```
   git push -u origin feat/v3-finishing
   ```

d. Open PR using AGENTS.md PR template fields (Affected Modules /
   Contracts, Validation, Risk Flags filled). Body should list the
   6 tasks + per-task commit hash. Use `gh pr create --base main
   --head feat/v3-finishing --title "design(v3): finishing tasks
   (T1-T5)" --body "$(cat <<'EOF' ... EOF)"`. Do NOT mark merged.

e. Wait for CI checks to complete on the PR. Poll every 30s up to
   10 minutes:
   ```
   gh pr checks <PR_NUMBER>
   ```
   If any check fails, fix and push amended commits to the branch
   (which re-triggers CI), then poll again. If all green:

f. Capture PR URL via `gh pr view <PR_NUMBER> --json url`. Output:
   ```
   PR ready for human merge: <URL>
   <promise>ALL_TASKS_COMPLETE</promise>
   ```

DO NOT `gh pr merge`. Human merges per AGENTS.md.

## State tracking

The Claude Code task list is the single source of truth. Mark each
T-task `in_progress` at start, `completed` immediately after commit
(NOT after push — push happens only at T6). Do not maintain a
parallel state file.

## Failure modes (don't pretend success)

- If a task can't reach guardrail / tsc / tests clean, commit
  `wip(<scope>)` partial and surface the blocker in next iteration's
  output. Do NOT mark task `completed`. Do NOT emit promise.
- If Codex stop-time review flags issues, fix in same iteration
  before commit.
- If CI on the open PR fails for an unrelated infra reason
  (Vercel / Macroscope / etc.), report and continue waiting; do not
  promise on red CI.
- If you discover a regression caused by an earlier task, revert
  or fix on the branch before promise.

Begin with the next incomplete task per TaskList. Do not narrate the
plan; do the work.
