## 1. Implementation

- [x] 1.1 Add a repository sitemap document as the new architecture navigation source of truth.
- [x] 1.2 Replace the active Canvas workflow references in `AGENTS.md`, `README.md`, and `docs/tdd/README.md`.
- [x] 1.3 Remove the current Canvas execution path from `package.json`.
- [x] 1.4 Delete the live architecture canvas module, its test, and the generated `architecture.canvas` artifact.
- [x] 1.5 Update coordination metadata to reflect the new repo-sitemap source of truth.

## 2. Verification

- [x] 2.1 `npm test`
- [x] 2.2 `npm run ci:local`
- [x] 2.3 `openspec validate 2026-03-28-replace-canvas-with-repo-sitemap --strict`
