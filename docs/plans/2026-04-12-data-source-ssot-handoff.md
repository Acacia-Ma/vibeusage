# Data Source SSOT Handoff Plan

> **For Claude Code / Codex:** use this as the context handoff before touching any fallback or compatibility path. Do not add a third source while trying to reconcile two existing ones.

**Goal:** eliminate non-unique fact paths in VibeUsage so every user-visible fact resolves from exactly one authoritative source per domain.

**Architecture:** keep raw collection append-only and minimal, keep cloud truth in PostgreSQL-backed contracts, and allow render-continuity helpers only when they are clearly marked as derived snapshots or cache fallbacks. If the same fact can currently be read from two different stores, pick one owner and hard-cut the other path instead of preserving both.

**Tech Stack:** Node.js CLI, React/Vite dashboard, InsForge edge functions, PostgreSQL, OpenSpec.

---

## 0. Why this handoff exists

Recent work fixed the Hermes live hourly bigint ingest bug and proved again that VibeUsage gets into trouble whenever one layer says a fact exists while another layer computes or serves that fact from somewhere else.

This repository already has several successful SSOT decisions:

- Hermes local usage = `~/.vibeusage/tracker/hermes.usage.jsonl`
- OpenClaw local usage = sanitized VibeUsage-owned ledger only
- dashboard identity = backend profile, not redirect/session display-name drift
- PR-body CI truth = live GitHub PR body, not stale event payload
- dashboard usage modules = backend usage endpoints as live truth; cache/snapshot only for continuity

The next step is to remove the remaining places where one contract can still answer from two different stores.

---

## 1. Non-negotiable principles

1. **No backward compatibility**
   - Do not keep a legacy path “just in case” if it answers the same fact as the new path.
   - If migration is too risky, stop and write the OpenSpec change first; do not ship a mixed design.

2. **Single source of truth**
   - One fact class → one authoritative producer → one authoritative read path.
   - Cache, snapshots, and render hydration are acceptable only when they are explicitly derived from the same truth and never masquerade as a second truth.

3. **First principles**
   - Prefer the narrowest explicit contract that emits the fact directly.
   - Reject reverse-engineering from transcripts, stale payloads, or UI-local state when a first-class source exists.

4. **Atomic commits**
   - Commit proposal/spec freeze separately from code deletion.
   - Commit fact-source hard-cuts separately from UI wording/docs alignment.

---

## 2. What is already settled and should stay settled

These are not the targets unless the code drifted away from them:

### 2.1 Hermes local usage

- **Authoritative source:** `~/.vibeusage/tracker/hermes.usage.jsonl`
- **Forbidden alternatives:** `~/.hermes/state.db`, `~/.hermes/sessions/`, trajectory files
- **Key references:**
  - `docs/plans/2026-04-10-hermes-plugin-ledger-integration-plan.md`
  - `openspec/changes/2026-04-10-add-hermes-plugin-ledger-integration/`
  - `src/lib/hermes-usage-ledger.js`
  - `src/templates/hermes-vibeusage-plugin/__init__.py`

### 2.2 OpenClaw local usage

- **Authoritative source:** sanitized VibeUsage-owned ledger written by the OpenClaw session plugin
- **Forbidden alternatives:** transcript parsing, `openclaw-legacy`, synthetic fallback totals, Gateway log accounting
- **Key references:**
  - `docs/superpowers/plans/2026-04-04-openclaw-sanitized-usage-ingress.md`
  - `openspec/changes/refactor-openclaw-sanitized-usage-ingress/`

### 2.3 Dashboard identity

- **Authoritative source:** authenticated backend profile / current identity resolver
- **Forbidden alternatives:** redirect `name`, stale `session.user.name`
- **Key references:**
  - `docs/plans/2026-03-23-dashboard-identity-ssot-implementation-plan.md`

### 2.4 PR review gate body source

- **Authoritative source:** live GitHub PR object body
- **Fallback only:** `GITHUB_EVENT_PATH` if live API is unavailable
- **Key references:**
  - `docs/ops/pr-review-preflight.md`

### 2.5 Dashboard usage truth contract

- **Authoritative source:** backend usage endpoints
- **Fallback only:** prior successful backend snapshot for the same period, or cache after request failure
- **Key references:**
  - `openspec/changes/2026-03-27-optimize-dashboard-period-switch-latency/specs/vibeusage-tracker/spec.md`
  - `dashboard/src/lib/dashboard-live-snapshot.ts`
  - `dashboard/src/lib/dashboard-cache.ts`

---

## 3. Highest-priority remaining non-unique fact hotspots

## 3.1 P0 — Leaderboard read path still answers from two stores

### Current situation

`insforge-src/functions-esm/vibeusage-leaderboard.js` still has two materially different read paths for the same response contract:

1. **snapshot path**
   - reads `public.vibeusage_leaderboard_snapshots`
   - returns stored `generated_at`
2. **fallback/current path**
   - reads `vibeusage_leaderboard_*_current` views
   - synthesizes `generated_at: new Date().toISOString()`
   - may return the same conceptual fact from a different storage path

`insforge-src/functions-esm/vibeusage-leaderboard-profile.js` is already snapshot-backed, which makes the list/profile pair even less coherent if the list endpoint falls back to current views.

### Why this is a real SSOT bug

- one API contract can return facts from two different stores
- freshness semantics differ
- troubleshooting gets ambiguous: “is the bug in refresh, snapshots, fallback views, or the endpoint chooser?”
- list/profile can disagree even if both are individually “working as coded”

### Recommended hard-cut

Make leaderboard responses read from **exactly one store**.

Recommended choice:

- **authoritative read store:** `public.vibeusage_leaderboard_snapshots`
- **owner of materialization:** `insforge-src/functions-esm/vibeusage-leaderboard-refresh.js`
- **remove or demote:** `_current` read fallback from `vibeusage-leaderboard.js`

If snapshots are missing/stale, return an explicit not-ready/stale response instead of silently switching to another truth source.

### First files to inspect

- `insforge-src/functions-esm/vibeusage-leaderboard.js`
- `insforge-src/functions-esm/vibeusage-leaderboard-profile.js`
- `insforge-src/functions-esm/vibeusage-leaderboard-refresh.js`
- `insforge-src/shared/leaderboard-core.mjs`
- `test/edge-functions.test.js`
- `test/ssot-foundations.test.js`
- `dashboard/src/lib/__tests__/leaderboard-ui.test.js`

---

## 3.2 P1 — OpenCode local accounting is still not a true hard-cut SSOT

### Current situation

The repo has already moved to **SQLite-first** OpenCode parsing, but not yet a strict single-source contract.

Signals of mixed design still present:

- `README.md` / `README.zh-CN.md` still describe `opencode.db` with legacy message-file fallback
- `src/commands/sync.js` still constructs OpenCode inputs around both storage files and `opencode.db`
- `src/lib/rollout.js` still accepts both `messageFiles` and `opencodeDbPath`
- stable spec text still says legacy JSON files **MAY** be parsed when present

### Why this is a real SSOT bug

When SQLite and legacy files both exist, the answer to “what is the local OpenCode usage fact?” is still not singular. That keeps debugging and dedupe logic more complex than necessary.

### Recommended hard-cut

Pick one explicit rule:

- **authoritative local source:** `OPENCODE_HOME/opencode.db`
- **remove:** legacy message-file accounting for sync/audit/status truth

If migration constraints require temporary coexistence, document it as a short-lived migration phase with a removal date. Do not leave it as permanent supported behavior.

### First files to inspect

- `src/commands/sync.js`
- `src/lib/rollout.js`
- `src/lib/opencode-sqlite.js`
- `src/lib/opencode-usage-audit.js`
- `openspec/specs/vibeusage-tracker/spec.md`
- `test/rollout-parser.test.js`
- `test/opencode-usage-audit.test.js`
- `test/ssot-foundations.test.js`

---

## 3.3 P1 — Dashboard provenance labels need a full honesty audit

### Current situation

The dashboard already has a good spec direction: backend endpoints are live truth, while local snapshot/cache are continuity helpers.

Relevant hooks and helpers:

- `dashboard/src/hooks/use-usage-data.test.tsx`
- `dashboard/src/hooks/use-trend-data.test.ts`
- `dashboard/src/hooks/use-usage-model-breakdown.ts`
- `dashboard/src/hooks/use-activity-heatmap.test.ts`
- `dashboard/src/lib/dashboard-live-snapshot.ts`
- `dashboard/src/lib/dashboard-cache.ts`
- `dashboard/src/pages/DashboardPage.jsx`

### What to verify

- `source` / `provenance` / `generated_at` / `fetchedAt` must remain truthful
- a reused live snapshot from a **prior backend success** is okay, but should not be described as a second live data source
- cache fallback after request failure is okay, but the UI must never imply it is freshly fetched backend truth
- any `shared` / `client-derived` / `cache` label must reflect actual derivation semantics

### Recommended rule

Keep the current product behavior, but tighten the contract:

- **live truth:** backend response only
- **continuity:** previously resolved backend snapshot for the same period
- **degraded fallback:** cache after backend failure
- **never allowed:** client-local derivation presented as live backend fact

### First files to inspect

- `dashboard/src/hooks/use-usage-data.test.tsx`
- `dashboard/src/hooks/use-trend-data.test.ts`
- `dashboard/src/hooks/use-usage-model-breakdown.ts`
- `dashboard/src/hooks/use-usage-model-breakdown.test.ts`
- `dashboard/src/pages/DashboardPage.jsx`
- `test/ssot-foundations.test.js`

---

## 4. Recommended execution order

### Task 1: Freeze the fact-domain inventory in OpenSpec

Because this is a cross-module architecture hard-cut, start with a proposal before deleting fallback paths.

**Suggested change-id:** `refactor-data-source-ssot-boundaries`

The proposal should define, at minimum, these domains:

- leaderboard read truth
- OpenCode local usage truth
- dashboard usage provenance contract
- any remaining public identity / profile / share-state truth if discovered during audit

**Files:**
- `openspec/project.md`
- `openspec/specs/vibeusage-tracker/spec.md`
- `openspec/changes/refactor-data-source-ssot-boundaries/`

### Task 2: Hard-cut leaderboard to one read truth

**Primary objective:** remove mixed snapshot/current fallback semantics.

**Files:**
- `insforge-src/functions-esm/vibeusage-leaderboard.js`
- `insforge-src/functions-esm/vibeusage-leaderboard-profile.js`
- `insforge-src/functions-esm/vibeusage-leaderboard-refresh.js`
- `test/edge-functions.test.js`
- `test/ssot-foundations.test.js`

### Task 3: Hard-cut OpenCode local truth

**Primary objective:** make `opencode.db` the only supported local accounting source.

**Files:**
- `src/commands/sync.js`
- `src/lib/rollout.js`
- `src/lib/opencode-sqlite.js`
- `src/lib/opencode-usage-audit.js`
- `README.md`
- `README.zh-CN.md`
- `test/rollout-parser.test.js`
- `test/opencode-usage-audit.test.js`
- `test/ssot-foundations.test.js`

### Task 4: Audit dashboard provenance honesty

**Primary objective:** keep continuity UX without introducing a second truth.

**Files:**
- `dashboard/src/hooks/use-usage-data.tsx` or equivalent hook entrypoint
- `dashboard/src/hooks/use-trend-data.ts`
- `dashboard/src/hooks/use-usage-model-breakdown.ts`
- `dashboard/src/lib/dashboard-live-snapshot.ts`
- `dashboard/src/lib/dashboard-cache.ts`
- `dashboard/src/pages/DashboardPage.jsx`
- related hook tests

### Task 5: Align docs and regression guards

**Primary objective:** make the repo tell one story.

**Files:**
- `README.md`
- `README.zh-CN.md`
- `docs/repo-sitemap.md` only if a module boundary or first-read path changes
- `docs/ops/pr-review-preflight.md` if provenance rules evolve
- `test/ssot-foundations.test.js`

---

## 5. Suggested regression commands

Run focused checks instead of broad repo churn first.

### 5.1 Search for mixed-source patterns

```bash
rg -n "vibeusage_leaderboard_snapshots|_current|generated_at: new Date\(|source: \"cache\"|source: \"edge\"|messageFiles|opencodeDbPath|fallback|legacy" \
  insforge-src dashboard src README.md README.zh-CN.md openspec test
```

### 5.2 Backend/edge regression

```bash
node --test --test-concurrency=1 test/edge-functions.test.js test/ssot-foundations.test.js
```

### 5.3 OpenCode local parsing regression

```bash
node --test --test-concurrency=1 test/rollout-parser.test.js test/opencode-usage-audit.test.js test/ssot-foundations.test.js
```

### 5.4 Dashboard provenance regression

```bash
npm test -- dashboard/src/hooks/use-usage-data.test.tsx \
  dashboard/src/hooks/use-trend-data.test.ts \
  dashboard/src/hooks/use-usage-model-breakdown.test.ts
```

### 5.5 Full local confidence pass before PR

```bash
npm run ci:local
```

---

## 6. Definition of done

This handoff is complete only when all of the following are true:

1. For each targeted domain, one fact contract has one authoritative read store.
2. Removed paths are actually deleted or explicitly downgraded to continuity-only helpers.
3. User-visible provenance labels remain honest.
4. README / OpenSpec / tests all describe the same source-of-truth boundary.
5. `test/ssot-foundations.test.js` (or equivalent guard tests) prevents backsliding.
6. No mixed “temporary forever” design remains in the final PR.

---

## 7. What not to do

- Do **not** fix only the UI label while keeping dual fact stores behind it.
- Do **not** preserve a legacy path just because it currently helps one fixture pass.
- Do **not** treat a derived cache, stale event payload, transcript parse, or ad-hoc recomputation as equal to the explicit contract source.
- Do **not** ship a mixed design if the hard-cut is not ready; stop at proposal/design instead.

---

## 8. Most likely winning direction

If you need a default thesis before re-reading the whole repo, use this one:

- **local raw usage:** one append-only ledger / DB per integration
- **cloud facts:** PostgreSQL-backed canonical aggregate tables/views only
- **frontend live truth:** backend responses only
- **frontend continuity:** prior successful backend snapshot or cache after failure
- **public/read APIs:** one storage contract per endpoint, no silent fallback to a second truth source

That thesis matches the user’s stated preferences:

- no backward compatibility
- single source of truth
- first-principles design
- atomic commits
