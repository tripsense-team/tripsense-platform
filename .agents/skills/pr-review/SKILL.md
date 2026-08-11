---
name: pr-review
description: Perform PR-ready review of TripSense changes for correctness, requirements, service boundaries, API compatibility, database ownership, security, error handling, tests, secrets, docs, complexity, and dead or duplicated code. Use when asked to review a PR, branch, diff, or completed implementation.
---

# PR Review

Use this skill for PR-ready review of TripSense changes.

Do not modify code during review unless the user explicitly asks for fixes.

## Required Context

Read:

1. `AGENTS.md`
2. Relevant feature docs under `docs/features/`
3. Changed source and test files
4. Relevant architecture and service-boundary docs

## Checklist

Review:

1. Correctness
2. Requirement compliance
3. Service boundaries
4. API compatibility
5. Database ownership
6. Security
7. Error handling
8. Tests
9. Secrets
10. Documentation
11. Unnecessary complexity
12. Dead or duplicated code

## Finding Levels

- `BLOCKER`: must fix before merge.
- `HIGH`: likely bug, security issue, or serious maintainability problem.
- `MEDIUM`: meaningful risk or missing coverage.
- `LOW`: small correctness or maintainability improvement.
- `NIT`: style or clarity issue.

Lead with findings ordered by severity and grounded in file and line references.
