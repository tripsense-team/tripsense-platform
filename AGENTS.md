# TripSense Agent Rules

This repository uses a documentation-first, human-approved workflow for feature work.

Before changing application code, agents must:

1. Read this file.
2. Read [docs/index.md](docs/index.md).
3. Find relevant feature, architecture, workflow, service, domain, and ADR documents.
4. Use the multi-agent planning workflow in [docs/workflows/multi-agent-feature-workflow.md](docs/workflows/multi-agent-feature-workflow.md).
5. Stop at `STATUS: WAITING_FOR_HUMAN_APPROVAL` until a human explicitly approves implementation.

Application feature work must not begin from a feature request alone. Planning documents under `docs/features/<feature-name>/` are the source of truth for scope, decisions, tasks, tests, and review expectations.

## Skill Routing

Natural feature prompts must route to repo skills automatically:

- Use `.agents/skills/feature-planning` for unapproved feature requests such as "Plan login feature", "Create login feature", "Design trip sharing", "Add itinerary export", "Build booking flow", or any request asking what a feature should do before coding.
- Use `.agents/skills/feature-implementation` only when an approved feature plan exists and the user explicitly asks to implement it, such as "Implement approved login feature" or "Proceed with the approved trip sharing plan".
- Use `.agents/skills/architecture-review` for architecture, service-boundary, or design reviews.
- Use `.agents/skills/database-review` for schema, migration, persistence, data ownership, or transaction review.
- Use `.agents/skills/security-review` for auth, authorization, IDOR, secrets, abuse-case, or trust-boundary review.
- Use `.agents/skills/testing` for test planning or verification of an approved feature.
- Use `.agents/skills/pr-review` for PR-ready review.

If a prompt could require implementation but has no approved feature docs, route to feature planning and stop at the human approval gate.

Before implementation, check whether an approved feature plan exists in `docs/features/index.md` and `docs/features/<feature-name>/`. If no approved plan exists, do not modify application code.

## Architecture Guardrails

- Public traffic goes through the API Gateway.
- Each service owns its own data.
- Never query another service database.
- Never create cross-service JPA relationships.
- Use IDs and contracts across service boundaries.
- Prefer existing services when ownership is clear.
- Do not create a new microservice for every small feature.
- Use Kafka for asynchronous integration when eventual consistency is acceptable.
- Use synchronous calls only when the user flow requires immediate data.
- Keep external credentials backend-side.
- AI may assist decisions, but deterministic business rules must remain explicit and testable.

## Existing Repository Notes

- Web app agent notes exist at [apps/web/tripsense/AGENTS.md](apps/web/tripsense/AGENTS.md).
- Current checked-in services include API Gateway and several Spring services under `services/`.
- Some expected TripSense services may be planned but not present in the source tree yet. Plans must distinguish existing code from target architecture.
