# Change: Refactor model identity sync before pricing aliases

## Why

Pricing sync still derives pricing aliases directly from raw usage model names. That forces pricing logic to guess model families from unstable device-reported names and makes fallback coverage depend on pricing-side heuristics instead of canonical model identity.

## What Changes

- Add high-confidence canonical model alias generation for recent usage models before pricing alias generation runs.
- Backfill deterministic canonical aliases to each raw usage model's earliest observed date inside the sync scan window so historical windows collapse to one canonical `model_id`.
- Make pricing alias generation consume canonical models rather than raw usage models.
- Split diagnostics into `raw -> canonical` coverage and `canonical -> pricing` coverage so fallback causes stay observable.
- Keep ambiguous names on fallback; do not expand pricing-side guessing.

## Impact

- Affected specs: `vibeusage-tracker`
- Affected code: `insforge-src/functions-esm/vibeusage-pricing-sync.js`, pricing diagnostics SQL, pricing sync acceptance/tests
