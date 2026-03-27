## Context

`architecture.canvas` is currently wired into the repository workflow as a required architecture navigation artifact. The user has decided to replace that workflow with a plain explanation file that points people to the right directories and files directly. This is a workflow source-of-truth change, not a product behavior change.

## Goals / Non-Goals

- Goals:
  - Make a Markdown repo sitemap the single source of truth for repository navigation
  - Remove the current live Canvas workflow, script entrypoints, and generated artifact
  - Update active guidance so future work reads the sitemap instead of regenerating a canvas
- Non-Goals:
  - Rewriting historical plans, retrospectives, or archived OpenSpec changes
  - Changing website SEO files such as `sitemap.xml`
  - Replacing the interaction-sequence canvas workflow

## Decisions

- Decision: use a hand-authored Markdown sitemap instead of another generator
  - Why: the requested replacement is “file locations explained directly”, so a plain document is the simplest, most stable source of truth

- Decision: update only live workflow references and leave historical references as historical evidence
  - Why: old plans and retrospectives are records, not current execution sources; rewriting them would create churn without changing current behavior

- Decision: delete the current architecture canvas module entirely
  - Why: keeping the script or artifact around would preserve a parallel path and violate the single-source-of-truth rule

## Risks / Trade-offs

- The repo sitemap becomes a manually maintained document, so it must stay focused on stable entry points instead of file-by-file exhaustiveness
- Historical docs will still mention `architecture.canvas`, but that is acceptable as long as active guidance and executable paths no longer depend on it

## Verification

- `npm test`
- `npm run ci:local`
- `openspec validate 2026-03-28-replace-canvas-with-repo-sitemap --strict`
