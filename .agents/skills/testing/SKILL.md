---
name: testing
description: Plan or verify tests for approved TripSense features. Use for test planning, coverage review, regression verification, acceptance criteria tests, integration tests, contract tests, or security test planning tied to feature docs.
---

# Testing

Use this skill to define or verify tests for an approved TripSense feature.

## Required Context

Read:

1. `AGENTS.md`
2. The feature `requirements.md`
3. The feature `implementation-plan.md`
4. The feature `test-plan.md`
5. Relevant service or app test conventions

## Test Scope

Cover the risk introduced by the feature:

- unit tests for deterministic business rules;
- integration tests for service behavior and persistence;
- contract tests for API compatibility when useful;
- security tests for auth, authorization, ownership, and validation;
- regression tests for known edge cases;
- manual verification steps only where automation is not practical.

## Rules

- Tests must trace back to acceptance criteria or review findings.
- Do not broaden tests into unrelated refactors.
- If a required test cannot be run locally, document why and provide the exact command that should run in CI.
