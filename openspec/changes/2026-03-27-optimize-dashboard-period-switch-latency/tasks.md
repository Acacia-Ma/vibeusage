## 1. Implementation

- [x] 1.1 Add period-scoped in-memory snapshots for period-bound dashboard hooks so revisiting a resolved period can hydrate immediately from the last successful edge response.
- [x] 1.2 Split hook state into initial loading vs background refreshing so period switches keep visible data on screen while backend revalidation runs.
- [x] 1.3 Update dashboard usage panel wiring to reflect refreshing without collapsing summary content.
- [x] 1.4 Add regression coverage for snapshot hydration, background refreshing, and stable summary rendering during period switches.
- [x] 1.5 Run OpenSpec validation, targeted dashboard tests, typecheck, UI hardcode validation, and local CI.
