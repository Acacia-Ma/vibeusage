## MODIFIED Requirements

### Requirement: Usage endpoints canonicalize model identity

Usage endpoints SHALL resolve usage model names to a canonical `model_id` via `vibeusage_model_aliases` for the effective date. If no active canonical alias exists, the raw usage model SHALL remain the canonical `model_id`. The `model` query parameter SHALL accept a canonical id and expand to all active aliases for the requested range. Responses that include model identity SHALL emit both `model_id` (canonical) and display `model`.

#### Scenario: Missing canonical alias falls back to raw usage model

- **GIVEN** no active canonical alias exists for a requested usage model on the effective date
- **WHEN** a usage endpoint resolves model identity
- **THEN** it SHALL use the raw usage model as `model_id`

### Requirement: Pricing model aliases are supported

The system SHALL support alias mappings from canonical `usage_model` values to `pricing_model` values with an `effective_from` date and a `pricing_source`.

#### Scenario: Canonical alias hit resolves pricing model

- **GIVEN** a canonical usage model has an active pricing alias mapping
- **WHEN** the pricing resolver runs
- **THEN** it SHALL use the alias `pricing_model` for pricing lookup

### Requirement: Pricing sync writes canonical aliases before pricing aliases

The pricing sync job SHALL generate canonical aliases for recent raw usage models before generating pricing aliases. Only high-confidence, deterministic canonical aliases may be written automatically.

#### Scenario: High-confidence raw usage model is canonicalized

- **GIVEN** a recent raw usage model `qwen3.5-plus`
- **WHEN** pricing sync runs
- **THEN** it SHALL write a canonical alias mapping to `qwen/qwen3.5-plus`

#### Scenario: Ambiguous raw usage model stays unresolved

- **GIVEN** a recent raw usage model `kimi-for-coding`
- **WHEN** pricing sync runs
- **THEN** it SHALL NOT write a canonical alias row automatically

### Requirement: Pricing sync writes pricing aliases from canonical models

The pricing sync job SHALL generate pricing aliases from canonical models rather than raw usage model names. If a canonical model is still ambiguous or unmatched, pricing SHALL remain on fallback.

#### Scenario: Canonical model is mapped to a dated pricing model

- **GIVEN** a canonical model `qwen/qwen3.5-plus`
- **AND** the latest OpenRouter pricing model is `qwen/qwen3.5-plus-02-15`
- **WHEN** pricing sync runs
- **THEN** it SHALL write a pricing alias from `qwen/qwen3.5-plus` to `qwen/qwen3.5-plus-02-15`
