---
name: feature-planning
description: Plan unapproved TripSense features before implementation. Use for natural prompts like "Plan login feature", "Create login feature", "Design trip sharing", "Add itinerary export", "Build booking flow", "Implement login" when no approved plan exists, or any feature request that needs requirements, architecture, API, database, security, review, synthesis, documentation, and human approval before coding.
---

# Feature Planning

Use this skill when a user asks to plan a TripSense feature or provides a feature request that has not been approved yet.

Do not change application source code while using this skill.

## Required Context

Read:

1. `AGENTS.md`
2. `docs/index.md`
3. `docs/workflows/multi-agent-feature-workflow.md`
4. `docs/architecture/tripsense-architecture.md`
5. `docs/architecture/service-boundaries.md`
6. Existing related plans under `docs/features/`
7. Relevant source files only for inspection, not editing

## Process (Unified Expert Planning — Token Optimized)

To ensure maximum token efficiency without sacrificing engineering rigor, perform a **Unified Multi-Perspective Synthesis** in a single pass (acting as Lead Full-Stack Architect):

1. **Capture & Inspect**: Understand feature requirements, inspect existing codebase, models, and endpoints.
2. **Synthesize Perspectives**: Address all 6 core engineering domains:
   - **Product & Domain**: Core flow, in-scope, out-of-scope, acceptance criteria, domain invariants.
   - **Architecture & Boundaries**: Service ownership, sync REST vs async Kafka, no cross-service DB/JPA.
   - **API & Event Contracts**: Endpoints, HTTP methods, request/response DTOs, Kafka topic schemas.
   - **Database & Persistence**: Tables, types, indexes, and migration/rollback strategy.
   - **Security & Trust Boundaries**: JWT auth, RBAC, ownership checks (anti-IDOR), secrets backend-only.
   - **Devil's Advocate & Trade-offs**: Failure modes, race conditions, rejected alternatives & rationale.
3. **Generate Single Specification File**:
   - Create or update **exactly ONE file**: `docs/features/<feature-name>.md` using `docs/features/_template/feature-plan-template.md` as reference.
   - Do NOT create a folder with 9 separate files. Keep all details unified in this single document.
4. **Update Feature Index**:
   - Add/update the row in `docs/features/index.md` with status `WAITING_FOR_APPROVAL` linking to `[Docs](./<feature-name>.md)`.
5. **Stop at Approval Gate**:
   - Present the concise summary and link to `docs/features/<feature-name>.md`.
   - Conclude with `STATUS: WAITING_FOR_HUMAN_APPROVAL`.

## Output Style

- Be direct, technical, and concrete. Provide exact schemas, DTOs, endpoint paths, and SQL/Flyway snippets.
- Avoid verbose narrative, filler prose, or simulated chit-chat between agents.
- Expose decisions, trade-offs, and critical guards cleanly in tables and code blocks.

## Approval Gate

Do not write or modify application code until the user explicitly says the equivalent of `Approved`, `Implement`, or `Proceed`.

