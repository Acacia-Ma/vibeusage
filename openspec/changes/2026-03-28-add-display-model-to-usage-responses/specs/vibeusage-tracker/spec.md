## MODIFIED Requirements

### Requirement: Usage APIs expose stable model identity for pricing and display

The system SHALL keep `model_id` as the canonical internal key for usage filtering, aggregation, and pricing, and SHALL expose a separate `display_model` field for presentation when usage responses include model-level payloads.

#### Scenario: Vendor-prefixed canonical model gets a clean display name

- **GIVEN** a usage response model entry has `model_id = "anthropic/claude-sonnet-4.6"`
- **WHEN** the API serializes the response
- **THEN** the response SHALL keep `model_id = "anthropic/claude-sonnet-4.6"`
- **AND** it SHALL include `display_model = "claude-sonnet-4.6"`
- **AND** pricing and aggregation SHALL continue to use `model_id`

#### Scenario: Models without vendor prefix stay unchanged

- **GIVEN** a usage response model entry has `model_id = "gpt-4o"`
- **WHEN** the API serializes the response
- **THEN** the response SHALL include `display_model = "gpt-4o"`
- **AND** the system SHALL NOT require any new storage field to produce it
