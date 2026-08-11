---
name: database-review
description: Review TripSense feature plans or implementation changes for schema design, migrations, indexes, transactions, data ownership, and prohibited cross-service persistence patterns. Use for database review, migration review, JPA relationship review, or data-boundary questions.
---

# Database Review

Use this skill to review TripSense feature plans or implementation changes that affect persistence, migrations, indexes, transactions, or data ownership.

## Required Context

Read:

1. `AGENTS.md`
2. `docs/architecture/service-boundaries.md`
3. The feature `data-model.md`
4. Relevant service code and migration files when present

## Hard Rejections

Flag as `BLOCKER`:

- cross-service JPA relationships;
- direct access to another service database;
- shared writable tables across services;
- migration that changes another service's owned data without an approved integration plan.

## Review Checklist

- Owning service is explicit.
- Data ownership is not assigned to the wrong service.
- Schema changes match the approved plan.
- Migrations are reversible or have a clear rollback strategy.
- Unsafe schema changes are identified before implementation or merge.
- Indexes support expected query patterns.
- Missing indexes for new query paths are flagged.
- Transaction boundaries are local to the owning service.
- Eventual consistency risks are documented.
- Backfills and production migration risks are documented.
- Sensitive fields are protected appropriately.

Do not modify code during review unless the user explicitly asks for fixes.
