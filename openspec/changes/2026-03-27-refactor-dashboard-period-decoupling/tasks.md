## 1. Implementation

- [x] 1.1 Add dashboard wiring helpers and a dedicated recent usage hook so recent usage is no longer period-scoped.
- [x] 1.2 Restrict `CORE_INDEX` loading to its own usage hook instead of aggregating unrelated module loading state.
- [x] 1.3 Update period-dependent hooks to keep prior module state visible while the next refresh is in flight.
- [x] 1.4 Add regression coverage for recent usage independence, usage panel loading decoupling, and stable hook refresh behavior.
- [x] 1.5 Run OpenSpec validation, targeted dashboard tests, typecheck, UI hardcode validation, and local CI.
