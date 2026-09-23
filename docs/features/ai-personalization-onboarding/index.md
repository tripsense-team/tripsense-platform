# AI Personalization Onboarding

**STATUS: APPROVED**

Build the backend-first, consented travel-preference foundation used after registration so TripSense can personalize deterministic filters and later AI assistance without exposing private profile data or raw location unnecessarily. AI voice selection is explicitly excluded.

## Source flow reviewed

The supplied onboarding images establish these data groups: identity/home city and optional important locations; places visited and wish-list; optional typed interview note; travel party/budget/splurge priorities; accommodation and loyalty programs; restaurant/dietary preferences; weekend activities/free-text notes; completion and suggested next actions. Voice selection, voice recording and assistant personality are outside this flow.

## Planning mode

`SINGLE-AGENT ROLE SIMULATION`: specialist subagents were unavailable because the runtime usage quota was exhausted. This revision applies the required Product → Domain → Architecture → API/Database/Security → Devil's Advocate sequence.

## Documents

- [Requirements](requirements.md)
- [Architecture](architecture.md)
- [API](api.md)
- [Data model](data-model.md)
- [Security](security.md)
- [Decisions](decisions.md)
- [Implementation plan](implementation-plan.md)
- [Test plan](test-plan.md)
- [Backend code design](backend-code-design.md)

## Completion-gate revision

Every account, including accounts created before this feature is released, must not access the main application until it has completed the onboarding flow. Closing the browser or leaving the flow preserves `IN_PROGRESS` server state and the next authenticated session resumes it. “Skip” applies to an individual question only; it no longer exits the flow or marks it completed.

STATUS: APPROVED
