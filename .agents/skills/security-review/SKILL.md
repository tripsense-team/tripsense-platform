---
name: security-review
description: Review TripSense feature plans or implementation changes for authentication, authorization, ownership validation, IDOR, input validation, secrets, abuse cases, and service trust boundaries. Use for security review, auth review, API exposure review, or threat checks.
---

# Security Review

Use this skill to review TripSense feature plans or implementation changes for authentication, authorization, trust boundaries, secrets, and abuse cases.

## Required Context

Read:

1. `AGENTS.md`
2. `docs/architecture/tripsense-architecture.md`
3. `docs/architecture/service-boundaries.md`
4. The feature `security.md`
5. Relevant API, backend, gateway, and configuration files

## Review Checklist

- Authentication requirements are explicit.
- Authorization checks match resource ownership.
- IDOR risks are addressed.
- Privilege escalation paths are considered.
- User-controlled input is validated.
- User-provided identity is not trusted as authority.
- Service-to-service trust is not assumed blindly.
- Secrets and external credentials remain backend-side.
- Logs do not expose secrets, tokens, or sensitive personal data.
- Abuse cases and rate-limit needs are documented.
- AI or external integrations cannot bypass business rules.

## Findings

Categorize findings as `BLOCKER`, `HIGH`, `MEDIUM`, `LOW`, or `NIT`.

Do not modify code during review unless the user explicitly asks for fixes.
