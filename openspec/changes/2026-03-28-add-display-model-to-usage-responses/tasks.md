## 1. Implementation

- [x] 1.1 Add failing tests for backend usage responses and dashboard helpers that require `display_model`.
- [x] 1.2 Add a shared backend helper that derives `display_model` without changing `model_id`.
- [x] 1.3 Emit `display_model` from usage breakdown and filtered usage summary responses.
- [x] 1.4 Update dashboard consumers to prefer `display_model` while keeping `model` as fallback.
- [x] 1.5 Rebuild any generated artifacts if shared backend modules change.

## 2. Verification

- [x] 2.1 Targeted `node --test` for backend response tests
- [x] 2.2 Targeted `node --test` for dashboard model breakdown tests
- [x] 2.3 `npm run build:insforge:check`
- [x] 2.4 `openspec validate 2026-03-28-add-display-model-to-usage-responses --strict`
