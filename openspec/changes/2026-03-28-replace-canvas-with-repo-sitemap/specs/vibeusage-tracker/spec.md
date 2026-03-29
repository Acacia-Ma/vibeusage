## ADDED Requirements

### Requirement: Repository navigation uses a repo sitemap

The repository SHALL use a plain Markdown repo sitemap as the active source of truth for architecture navigation and file-location guidance.

#### Scenario: Read current architecture guidance

- **WHEN** an engineer needs repository navigation guidance for a non-trivial change
- **THEN** the active instructions SHALL point to the repo sitemap document instead of requiring `architecture.canvas`

### Requirement: The live workflow does not depend on architecture canvas generation

The repository SHALL NOT require generation or maintenance of `architecture.canvas` for active implementation workflows.

#### Scenario: Follow active workflow guidance

- **WHEN** an engineer follows `AGENTS.md`, `README.md`, or active TDD guidance
- **THEN** those instructions SHALL not require running `scripts/ops/architecture-canvas.cjs`
