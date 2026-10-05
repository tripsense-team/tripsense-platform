# Requirements

## User goal

After account registration, a traveler must complete a skippable-question onboarding interview before accessing the main application. TripSense uses only consented answers to improve recommendations and future AI planning.

## Captured information

| Step         | Data                                               | AI use                                                                |
| ------------ | -------------------------------------------------- | --------------------------------------------------------------------- |
| Basics       | display name, home city, optional home/work places | greeting and local context; exact places are never default AI context |
| Places       | visited and wish-list canonical destinations       | novelty, inspiration and destination ranking                          |
| Interview    | optional typed note                                | extract reviewable preference signals only                            |
| Travel style | party, budget tier, splurge categories             | itineraries and recommendation constraints                            |
| Stay         | accommodation types and loyalty program names      | hotel filtering; no membership numbers                                |
| Food         | venue styles and dietary restrictions              | restaurant filtering and safety warnings                              |
| Activities   | weekend interests and optional free-text note      | activity ranking and plan tone                                        |

## Acceptance criteria

- Every question is skippable, but the flow itself is a required account-completion gate for accounts created after rollout. Skipping a question records no answer and moves to the next question.
- `NOT_STARTED` and `IN_PROGRESS` accounts are redirected to onboarding before any main-app screen. Closing a browser or losing connectivity never clears the gate; the next authenticated session resumes from the saved server state.
- Existing accounts are not grandfathered. Any account without an onboarding lifecycle in Context, or with `IN_PROGRESS`, is gated until it reaches `COMPLETED`.
- Values are typed/enumerated where possible; destinations use a canonical Place reference, never free text as the primary key.
- A user can review, edit, export and delete onboarding answers and derived preference signals.
- AI receives a minimal, purpose-scoped preference context, with source, confidence and freshness; it does not read User or Context databases directly.
- Dietary/religious restrictions and precise important locations require separate explicit consent and are excluded by default from Community and analytics.
- Voice, recording, speech transcription and assistant persona settings are not captured by this onboarding backend.
- Completion is idempotent and emits a versioned preference-change event; repeated submissions do not duplicate selections.

## Out of scope

- Silent device location collection, calendar import without OAuth consent, loyalty account numbers, payment data, advertising profiles, Community publication, and autonomous AI changes to user preferences.

## Open questions

1. What retention period is approved for raw optional interview text? Recommended: delete after signal extraction unless the user elects to retain it.
