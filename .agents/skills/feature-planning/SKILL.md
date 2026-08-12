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
6. Existing related files under `docs/features/`
7. Relevant source files only for inspection, not editing

## Process

1. Capture the feature request.
2. Find relevant knowledge graph nodes: services, domains, architecture docs, workflows, ADRs, and related features.
3. If the runtime supports subagents or parallel agents, delegate to separate subagents and use parallel execution where supported:
   - Round 1: Product Agent, Domain Agent, Architecture Agent.
   - Wait for Round 1 results.
   - Round 2: API / Backend Agent, Database Agent, Security Agent.
   - Wait for Round 2 results.
   - Round 3: Devil's Advocate Agent.
   - Wait for Round 3 results.
   - Main Orchestrator / Lead Architect performs final synthesis.
4. If subagents are unavailable, label the plan mode `SINGLE-AGENT ROLE SIMULATION`.
5. Preserve the required planning sequence:
   Feature Request -> Product -> Domain -> Architecture -> API -> Database -> Security -> Devil's Advocate -> Synthesis -> Human Approval -> STOP
6. Create or update `docs/features/<feature-name>/` from `docs/features/_template/`.
7. Update `docs/features/index.md`.
8. Validate relative Markdown links.
9. Stop with `STATUS: WAITING_FOR_HUMAN_APPROVAL`.

## Output

Use the concise planning format from `docs/workflows/multi-agent-feature-workflow.md`.

Expose only conclusions, disagreements, findings, decisions, and tradeoffs. Do not expose private chain-of-thought or dump full internal reasoning for each agent.

## Approval Gate

Do not implement until the user explicitly says the equivalent of `Approved`, `Implement`, or `Proceed`.
