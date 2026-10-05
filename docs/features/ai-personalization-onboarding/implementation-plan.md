# Implementation Plan

Implementation starts only after approval.

1. [x] Scaffold the Context service with the documented `domain`/`application`/`adapter` package boundaries, Gateway route, JWT validation and transactional outbox. Clock abstraction is deferred because no user-visible time rule is enabled yet.
2. [x] Implement catalog, aggregate/value objects and command/query use cases with domain/application tests before HTTP/JPA adapters.
3. [x] Add the versioned preference-dimension catalog, typed selection/attribute schema and Flyway migrations; keep JPA entities/mappers inside persistence adapters. Attribute/free-text writes remain disabled pending the security controls in step 8.
4. [x] Implement resume/versioning/delete and purpose-scoped preference APIs, typed error mapping and idempotent completion. Integration tests for PostgreSQL/JWT/outbox rows remain deployment verification work; domain tests cover version conflicts and completion idempotency. Export is intentionally deferred until the privacy export contract is approved.
5. Add bounded Place-reference validation/projection and User consent/basic-profile boundary through ports, never direct database access.
6. Add a purpose-scoped AI preference read contract and cache-invalidation event consumer with contract tests.
7. Replace the current client-side skip behavior with a required, server-authoritative completion gate:
   - add `GET /api/users/me/onboarding-gate` and an idempotent completion acknowledgement;
   - make Context reads non-creating and add explicit `start` for new eligible accounts;
   - initialize eligibility for new local/Google accounts and grandfather existing accounts in a migration;
   - block `UserLayout` until the User gate and Context lifecycle agree, then resume `IN_PROGRESS` at the last persisted step;
   - remove whole-flow skip; retain per-question skip only.
   - replace grandfathering: all accounts with no Context profile are `NOT_STARTED` and are redirected to `start`; stop using `user_profiles.onboarding_required` as an access decision and migrate existing rows for compatibility only.
8. Add sensitive-data consent, encryption/retention jobs and audit controls before enabling free text or important locations.
9. Keep calendar OAuth, voice selection and voice recording behind separately approved plans.

Stop for a planning revision if Context ownership, sensitive-data consent, Place identity, event schema or AI-access model changes.
