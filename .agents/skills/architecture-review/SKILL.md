---
name: architecture-review
description: Review TripSense feature plans or implementation changes for architecture fit, service ownership, service boundaries, sync versus async communication, coupling, and alignment with shared architecture docs. Use for architecture review, design review, service-boundary review, or microservice ownership questions.
---

# Architecture Review

Use this skill to review TripSense feature plans or implementation changes for architecture fit.

## Required Context

Read:

1. `AGENTS.md`
2. `docs/architecture/tripsense-architecture.md`
3. `docs/architecture/service-boundaries.md`
4. `docs/workflows/multi-agent-feature-workflow.md`
5. The relevant feature docs under `docs/features/`
6. Changed source files when reviewing implementation

## Review Checklist

- Service ownership is clear.
- Existing services are preferred when ownership is clear.
- No new microservice is proposed without a strong boundary reason.
- Public traffic flows through API Gateway.
- No cross-service database access is introduced.
- No cross-service JPA relationship is introduced.
- No hardcoded service URLs bypass discovery, gateway policy, or configuration.
- Sync calls are justified by user flow needs.
- Async events are used where eventual consistency is acceptable.
- Dependencies do not create avoidable coupling.
- Responsibilities are not duplicated across services.
- Architecture changes are documented in feature docs or ADRs.
- AI decisions do not replace deterministic business rules.
- Planned implementation matches the approved feature docs.

## Findings

Categorize findings as `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, or `NIT`.

Do not modify code during review unless the user explicitly asks for fixes.
