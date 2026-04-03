## 1. Implementation

- [x] 1.1 Add the OpenCode SQLite reader module and route sync/audit through `opencode.db`
- [x] 1.2 Persist SQLite reader health in `cursors.opencodeSqlite` and return health metadata from `parseOpencodeIncremental(...)`
- [x] 1.3 Expose OpenCode SQLite health in `diagnostics`, `status`, `doctor`, and manual `sync` warnings
- [x] 1.4 Update README and AI agent install docs to describe SQLite-first OpenCode storage and `sqlite3` requirements
- [x] 1.5 Add regression coverage for SQLite-only sync, project attribution, audit, diagnostics, status, and doctor
- [x] 1.6 Run OpenSpec validation, automated regression tests, and manual SQLite-only verification
