---
name: feature-implementation
description: Implement only already-approved TripSense feature plans. Use when the user explicitly says to implement, proceed, or build an approved feature whose docs show APPROVED; never use for unapproved feature requests or design changes that need planning.
---

# Feature Implementation

Use this skill only for a TripSense feature whose documentation status is `APPROVED`.

Do not use this skill for unapproved features.

## Required Context

Before coding, read:

1. `AGENTS.md`
2. `docs/index.md`
3. The feature folder under `docs/features/<feature-name>/`
4. Affected service docs and architecture docs
5. Relevant ADRs if present
6. Current source code for affected areas

## Process

1. Confirm the feature is `APPROVED` in `docs/features/index.md` or the feature docs.
2. Implement only the approved architecture.
3. Add or update tests from `test-plan.md`.
4. Run appropriate verification.
5. Run architecture review.
6. Run database review.
7. Run security review.
8. Run PR review.
9. Update feature docs only when documenting the implemented approved design.

## Stop Conditions

Stop and request a planning revision if implementation discovers a design problem that requires changing:

- service ownership;
- API shape;
- database ownership;
- migrations;
- security model;
- event contracts;
- approved acceptance criteria.

Never silently change the approved architecture.
