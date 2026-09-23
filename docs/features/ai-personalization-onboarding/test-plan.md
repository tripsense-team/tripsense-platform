# Test Plan

- Verify a new account is blocked from every main-app route while `NOT_STARTED`/`IN_PROGRESS`, then can enter only after Context `COMPLETED` and User gate acknowledgement.
- Verify a browser close, logout/login, second device, refresh, network failure and completion-ack retry all resume onboarding without losing saved answers or bypassing the gate.
- Verify existing accounts with no Context profile are redirected to onboarding; local and Google accounts both become gate-eligible; a returning account with `COMPLETED` never resets.
- Verify per-question skip persists an absent answer but never changes lifecycle to `COMPLETED`; stale version produces `409` without lost answers.
- Validate enum/length/selection limits and canonical Place references; duplicate submits stay idempotent.
- Verify user A cannot read/write/delete user B; expired/invalid JWTs fail; logs/events exclude free text, precise locations and sensitive values.
- Verify sensitive consent gates, encryption at rest, retention purge and calendar token absence.
- Contract-test Context-to-AI output by purpose: only allowed derived signals, source/confidence/freshness present.
- Verify AI cache invalidates on the versioned event and deterministic filters use selected budget/dietary/accommodation constraints.
- Browser tests cover progress, keyboard controls, empty/skipped state, recovery from network failure and privacy copy.
