# Change: Replace the architecture canvas workflow with a repo sitemap

## Why

The repository currently treats `architecture.canvas` as a mandatory architecture navigation source, but that workflow adds tooling and maintenance overhead without being the preferred way to explain file locations anymore. The new source of truth should be a plain repository sitemap document that humans can read directly and update intentionally.

## What Changes

- Replace the live Canvas workflow with a repository sitemap document as the architecture navigation source of truth
- Remove the current Canvas execution path from `AGENTS.md`, `README.md`, and active TDD guidance
- Delete the live architecture canvas generator, its test, and the generated `architecture.canvas` artifact
- Keep website SEO assets such as `dashboard/public/sitemap.xml` unchanged

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code:
  - `AGENTS.md`
  - `README.md`
  - `package.json`
  - `docs/tdd/README.md`
  - `docs/repo-sitemap.md`
  - `docs/architecture-canvas.md`
  - `scripts/ops/architecture-canvas.cjs`
  - `test/architecture-canvas.test.js`
  - `architecture.canvas`
