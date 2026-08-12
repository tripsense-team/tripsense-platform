# Multi-Agent Feature Workflow

Every new feature must pass through planning, challenge, approval, implementation, and review. The orchestrator coordinates the work but does not make implementation decisions alone.

## Status Flow

`DRAFT` -> `IN_REVIEW` -> `WAITING_FOR_APPROVAL` -> `APPROVED` -> `IMPLEMENTING` -> `DONE`

## Roles

- Orchestrator: reads [AGENTS.md](../../AGENTS.md), finds related knowledge graph nodes, coordinates agents, and keeps the process moving.
- Product Agent: user goal, use cases, acceptance criteria, business rules, edge cases, out-of-scope items.
- Domain Agent: domain concepts, entities, value objects, ownership, state transitions, invariants.
- Architect Agent: affected services, service boundaries, sync vs async communication, dependencies, existing constraints, need for new service.
- API/Backend Agent: endpoints, DTOs, validation, errors, service calls, events, backward compatibility.
- Database Agent: schema, migrations, indexes, data ownership, transaction boundaries, migration risks.
- Security Agent: auth, authorization, ownership validation, input validation, secrets, abuse cases, IDOR, trust boundaries.
- Devil's Advocate: attacks complexity, ownership, coupling, duplication, races, consistency, security, missing edge cases, sync calls, DB design, unclear requirements, maintainability.
- Synthesizer: resolves conflicts, documents tradeoffs, produces one final design, rejects unnecessary alternatives.

## Debate Process

When the runtime supports subagents or parallel agents, the orchestrator must delegate specialist analysis to separate agents. If subagents are unavailable, the orchestrator may simulate the roles in one agent, but the output must clearly label the mode as `SINGLE-AGENT ROLE SIMULATION`.

Required planning sequence:

Feature Request -> Product -> Domain -> Architecture -> API -> Database -> Security -> Devil's Advocate -> Synthesis -> Human Approval -> STOP

Product, Domain, and Architecture may run in parallel only when their inputs are independent and the synthesizer preserves the required review order in the final plan. API, Database, and Security may also run in parallel after the architecture draft exists.

## Real Subagent Delegation

When subagents are available, use this execution model:

1. Main Orchestrator receives the feature request and gathers context.
2. Round 1 runs parallel subagents:
   - Product Agent
   - Domain Agent
   - Architecture Agent
3. Main Orchestrator waits for Round 1 results.
4. Round 2 runs parallel subagents:
   - API / Backend Agent
   - Database Agent
   - Security Agent
5. Main Orchestrator waits for Round 2 results.
6. Round 3 runs a Devil's Advocate Agent.
7. Main Orchestrator acts as Lead Architect, synthesizes the final design, writes feature docs, and stops for human approval.

Do not expose private chain-of-thought. Expose only conclusions, findings, disagreements, decisions, and tradeoffs.

Do not invent artificial debate. Raise only meaningful engineering disagreements. Do not decide by majority vote.

## Planning Output

During planning, use this concise output shape:

```text
FEATURE
STATUS

REQUIREMENTS

AFFECTED SERVICES

FLOW

API

DATABASE

SECURITY

EVENTS / INTEGRATIONS

REVIEW FINDINGS

FINAL DECISIONS

IMPLEMENTATION TASKS

OPEN QUESTIONS

HUMAN APPROVAL REQUIRED
```

After planning, stop with:

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```

Only show the feature summary, final flow, affected services, API changes, database changes, events/integrations, security decisions, important tradeoffs, implementation tasks, and open questions.

## Required Feature Documents

Each feature must create:

- `docs/features/<feature-name>/index.md`
- `docs/features/<feature-name>/requirements.md`
- `docs/features/<feature-name>/architecture.md`
- `docs/features/<feature-name>/api.md`
- `docs/features/<feature-name>/data-model.md`
- `docs/features/<feature-name>/security.md`
- `docs/features/<feature-name>/decisions.md`
- `docs/features/<feature-name>/implementation-plan.md`
- `docs/features/<feature-name>/test-plan.md`

Use [docs/features/_template/](../features/_template/index.md) as the starting structure. Do not create filler content.

## Human Approval Gate

Implementation may begin only after the user explicitly says the equivalent of `Approved`, `Implement`, or `Proceed`.

If implementation discovers a design problem, stop and request a planning revision instead of silently changing the approved architecture.

## Related

- [TripSense Architecture](../architecture/tripsense-architecture.md)
- [Service Boundaries](../architecture/service-boundaries.md)
- [Feature Index](../features/index.md)
