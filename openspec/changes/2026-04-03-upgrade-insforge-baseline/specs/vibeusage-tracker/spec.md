## MODIFIED Requirements

### Requirement: Client integrations use InsForge SDK

The system SHALL route CLI and Dashboard InsForge interactions through the latest official `@insforge/sdk` baseline while preserving existing auth boundaries (`user_jwt` for dashboard reads, `device_token` for ingest). Repository call sites MUST converge on the official SDK auth/session contract and MUST NOT keep long-lived compatibility logic whose only purpose is preserving superseded SDK behavior.

#### Scenario: CLI requests use SDK wrapper

- **WHEN** the CLI issues a device token or uploads ingest events
- **THEN** the request SHALL be executed via the official SDK client wrapper
- **AND** the request SHALL still authenticate with the same token type as before

#### Scenario: Dashboard requests use SDK wrapper

- **WHEN** the dashboard fetches usage summary/daily/heatmap/leaderboard data
- **THEN** the request SHALL be executed via the official SDK client wrapper
- **AND** the dashboard SHALL continue to use `user_jwt` for authorization

#### Scenario: Official session contract replaces old local compatibility behavior

- **GIVEN** the repository upgrades to a newer official InsForge SDK baseline
- **WHEN** dashboard auth/session restore behavior changes under that baseline
- **THEN** repository call sites SHALL update to the new official contract
- **AND** the repository SHALL NOT add long-lived compatibility branches to preserve the superseded SDK session behavior

### Requirement: SDK version is pinned consistently

The system SHALL pin the same latest official `@insforge/sdk` version in both the root package and the dashboard package.

#### Scenario: Dependencies are aligned

- **WHEN** `package.json` in root and `dashboard/` are inspected
- **THEN** both SHALL reference the same `@insforge/sdk` version string
- **AND** the resolved lockfiles SHALL install that same official SDK version
