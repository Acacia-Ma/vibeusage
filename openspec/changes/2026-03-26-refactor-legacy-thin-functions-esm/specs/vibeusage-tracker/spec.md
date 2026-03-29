## ADDED Requirements

### Requirement: Thin legacy edge functions use the deployable ESM pipeline

The system SHALL author the thin diagnostic and retired/public-view edge-function batch from a single deployable ESM source path.

#### Scenario: Build artifacts for the migrated thin batch are deployable

- **GIVEN** the migrated thin batch contains `vibeusage-debug-auth`, `vibeusage-public-view-issue`, `vibeusage-public-view-revoke`, `vibeusage-public-view-status`, and `vibeusage-leaderboard-settings`
- **WHEN** the edge-function build runs
- **THEN** each corresponding artifact SHALL be generated from `insforge-src/functions-esm/`
- **AND** each artifact SHALL remain a single file without CommonJS bundle wrappers such as `__commonJS`, `module.exports`, or `require(...)`
