# Decisions

| Decision                                     | Rationale                                                                                                                               | Rejected alternative                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Context owns preference context              | Keeps AI-ready signals separate from identity and trip lifecycle.                                                                       | Store all onboarding JSON in User or AI databases.                      |
| Typed selections plus optional isolated text | Deterministic filtering is auditable; text can improve later extraction without contaminating every read.                               | One opaque AI prompt blob.                                              |
| Canonical Place references                   | Supports deduplication and locale-safe destination meaning.                                                                             | Persisting city labels as identifiers.                                  |
| AI reads derived context only                | Limits exposure and makes recommendations explainable.                                                                                  | Direct AI database access/raw profile dump.                             |
| Actual behavior is a separate source         | Onboarding is a stated preference, not truth forever. Later observations may update confidence but never overwrite the answer silently. | Treat onboarding as permanent fact.                                     |
| Backend uses a versioned dimension catalog   | New preference fields can be added additively while validation, sensitivity and AI eligibility remain explicit.                         | A fixed wide table or arbitrary unvalidated JSON blob.                  |
| Voice is excluded from V1                    | The requested backend stores travel preferences only; voice adds provider, recording and biometric/privacy scope.                       | Treat voice choice as ordinary travel-preference data.                  |
| Completion gate is server-authoritative      | Browser closure, device changes and retries cannot silently bypass onboarding. User owns eligibility; Context owns lifecycle.           | Local storage/session flags or a client-only redirect.                  |
| Skip questions, not the flow                 | Keeps minimum personalization/account-completion invariant while respecting users who do not wish to answer a question.                 | A “skip onboarding” action that incorrectly marks the profile complete. |

## Review findings

- **HIGH:** Home/work addresses and dietary/religious answers are sensitive; they need separate consent and must never be default AI/Community context.
- **HIGH:** Calendar integration needs a separate OAuth/security design, not a “Connect” button that imports historical events by default.
- **MEDIUM:** Optional interview text has retention and safety implications; V1 uses typed choices and optional text only.
