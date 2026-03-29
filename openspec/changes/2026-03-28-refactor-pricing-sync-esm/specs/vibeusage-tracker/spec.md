## ADDED Requirements

### Requirement: Pricing sync uses the deployable ESM pipeline

The system SHALL author `vibeusage-pricing-sync` from a single deployable ESM source path so pricing-profile and alias-sync changes can reach production without legacy CommonJS deploy wrappers.

#### Scenario: Pricing sync artifact is generated from the ESM source

- **GIVEN** `vibeusage-pricing-sync` is part of the migrated ESM batch
- **WHEN** the edge-function build runs
- **THEN** the generated `insforge-functions/vibeusage-pricing-sync.js` artifact SHALL be built from `insforge-src/functions-esm/vibeusage-pricing-sync.js`
- **AND** the artifact SHALL not include CommonJS bundle wrappers such as `__commonJS`, `module.exports`, or `require(...)`
