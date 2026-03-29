# TDD Workflow

## Purpose

- Keep behavior changes test-driven and verifiable.
- Reduce architectural blind spots before writing tests or code.

## Progressive Disclosure (Repository Sitemap)

Use the repo sitemap to narrow the read scope before opening code.

1. Read the top-level map
   - `docs/repo-sitemap.md`
2. Open the target module section
   - Follow the listed entry files for that area
3. Expand only when necessary
   - Read adjacent modules only if the sitemap says the flow crosses boundaries

## Granularity Guidelines

- Small changes (single function or localized edits):
  - Read the primary module section only.
- Medium changes (multiple files within a module):
  - Read the module section, then expand to adjacent sections as needed.
- Large changes (cross-module data flow or interfaces):
  - Expand step-by-step along the sitemap path.
  - Update the sitemap if the flow or preferred entry files changed.

## TDD Cycle

- RED: write a failing test for one behavior.
- GREEN: implement the minimal change to pass.
- REFACTOR: clean up without changing behavior.

## Regression Gate

- Run a targeted regression test for the change.
- Record the command and result in `docs/pr/`.
