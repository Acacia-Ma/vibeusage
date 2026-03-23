## 1. Implementation

- [x] 1.1 Add a single current-identity resolver in the dashboard auth layer that hydrates profile data from the backend using authenticated `userId`.
- [x] 1.2 Update dashboard identity consumers to read only from the resolver instead of `auth.name` or redirect payloads.
- [x] 1.3 Remove `name` from dashboard redirect payload generation and callback-dependent display logic.
- [x] 1.4 Add regression tests for token-only session restore, profile-driven identity rendering, and redirect payload removal.
- [x] 1.5 Run targeted dashboard regression tests and typecheck, then record the executed commands and results.
