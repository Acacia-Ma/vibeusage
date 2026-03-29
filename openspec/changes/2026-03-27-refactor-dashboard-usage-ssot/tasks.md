## 1. Implementation

- [x] 1.1 Remove `sharedRows/sharedRange` trend wiring and make trend periods fetch backend data directly.
- [x] 1.2 Remove client-derived heatmap generation in hooks and UI, using backend heatmap responses as the only live source.
- [x] 1.3 Restrict usage-related cache handling to failure fallback paths and align loading/source semantics across hooks.
- [x] 1.4 Add regression coverage for trend, heatmap hook, and heatmap component SSOT behavior.
- [x] 1.5 Run OpenSpec validation, targeted dashboard checks, and full local CI.
