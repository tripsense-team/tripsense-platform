# TripSense Feature Planning & Implementation Workflow

This workflow standardizes how features are planned, challenged, approved, implemented, and verified in TripSense.
It is engineered for **high technical rigor with maximum token efficiency**, producing a **single, comprehensive review file** for human approval.

## Status Flow

`DRAFT` -> `WAITING_FOR_APPROVAL` -> `APPROVED` -> `IMPLEMENTING` -> `DONE`

---

## Unified Expert Planning (Token-Optimized)

Instead of spawning multiple rounds of subagents (which causes massive token waste, redundant context loading, and API timeouts), the planning agent acts as a **Lead Full-Stack Architect** performing a **Unified Multi-Perspective Synthesis** in a single context pass.

The analysis synthesizes 6 critical engineering perspectives:
1. **Product & Domain**: User goals, core flows, in-scope vs out-of-scope, acceptance criteria, domain invariants.
2. **Architecture & Service Boundaries**: Affected services, data ownership, synchronous REST (via API Gateway) vs asynchronous messaging (Kafka), respecting no cross-service DB/JPA guardrails.
3. **API & Event Contracts**: Endpoints, HTTP verbs, request/response DTOs, Kafka topics and event schemas.
4. **Database & Persistence**: Tables/collections, schema, fields, types, indexes, and migration/rollback strategies.
5. **Security & Trust Boundaries**: Authentication, RBAC, ownership verification (IDOR prevention), input validation, secret hygiene.
6. **Devil's Advocate & Trade-offs**: Concurrency, eventual consistency lag, failure modes, rejected alternatives with rationale.

---

## Single-File Specification (`docs/features/<feature-name>.md`)

Every feature produces **exactly ONE markdown document** under `docs/features/<feature-name>.md` (or `docs/features/<feature-name>/plan.md` if bundled with dedicated assets).
This file serves as the **Single Source of Truth (SSOT)** for human review, approval, implementation, and testing.

### Standard Structure of `<feature-name>.md`

```markdown
# [Feature Name] — Specification & Implementation Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`
- **Owner Service**: `services/<service-name>`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, ...
- **Date**: YYYY-MM-DD

## 1. Goal & Requirements
- User journey & problem solved
- In-Scope & Out-of-Scope
- Acceptance Criteria

## 2. Architecture & Service Boundaries
- System interaction / data flow
- Service ownership & boundaries (no cross-service DB/JPA)
- Communication: Sync (Gateway REST) vs Async (Kafka)

## 3. API & Event Contracts
- REST Endpoints (method, path, auth, request DTO, response DTO, status codes)
- Kafka Events (topic, event key, payload schema)

## 4. Data Model & Migrations
- Schema/Tables, columns, data types, indexes
- Foreign keys (internal to service only)
- Migration & rollback strategy

## 5. Security & Trust Boundaries
- Auth & authorization rules
- Ownership checks (anti-IDOR)
- Input validation & secrets backend-only

## 6. Devil's Advocate & Technical Tradeoffs
- Concurrency / race conditions / failure handling
- Rejected alternatives & why

## 7. Phased Implementation Tasks & Verification
- Atomic phases / PR boundaries
- Unit & integration test plan
- Exact verification commands

---
## Human Approval Gate
Stop at `STATUS: WAITING_FOR_HUMAN_APPROVAL`. Awaiting human review.
```

---

## Human Approval Gate

Implementation is strictly blocked until a human reviews the single file and explicitly responds with `Approved`, `Implement`, or `Proceed` (or status is changed to `STATUS: APPROVED`).

If implementation reveals architectural blockers or scope changes:
1. Stop implementation immediately.
2. Update the single `<feature-name>.md` file.
3. Request human approval for the revision.

---

## Related Documents

- [Root Agent Rules](../../AGENTS.md)
- [TripSense Architecture](../architecture/tripsense-architecture.md)
- [Service Boundaries](../architecture/service-boundaries.md)
- [Feature Index](../features/index.md)
- [Feature Plan Template](../features/_template/feature-plan-template.md)

