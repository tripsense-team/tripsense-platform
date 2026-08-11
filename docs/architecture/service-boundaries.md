# Service Boundaries

Service ownership is the primary design constraint for TripSense feature planning.

## Hard Rules

- Never create cross-service JPA relationships.
- Never directly access another service database.
- Never share database tables between services.
- Never use another service's entity class as a persistence dependency.
- Use IDs, API DTOs, and events across service boundaries.

## Ownership Heuristics

- `identity-service`: authentication identity, credentials, tokens, login security.
- `user-service`: user profile and user-owned preferences.
- `trip-service`: trip lifecycle, trip ownership, trip membership, trip-level state.
- `place-service`: place data, location metadata, place lookup.
- `context-service`: contextual signals used for planning or recommendations.
- `itinerary-service`: itinerary structure, schedule, generated or curated plan items.
- `review-service`: reviews, ratings, moderation state.
- `notification-service`: notification preferences, delivery requests, delivery state.
- `ai-service`: AI orchestration, prompts, model calls, AI-specific evaluation.

When ownership is unclear, the feature plan must record alternatives and choose the simplest owner that preserves invariants.

## Communication Choices

Use synchronous APIs when:

- the caller needs an immediate answer to complete a user request;
- latency and availability tradeoffs are acceptable;
- the dependency is already part of the user-facing flow.

Use asynchronous events when:

- the work can complete later;
- multiple services need to react;
- the caller should not depend on downstream availability;
- eventual consistency is acceptable.

## Related

- [TripSense Architecture](tripsense-architecture.md)
- [Multi-Agent Feature Workflow](../workflows/multi-agent-feature-workflow.md)

