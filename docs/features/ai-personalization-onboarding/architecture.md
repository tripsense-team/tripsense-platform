# Architecture

## Affected services

| Concern                                           | Owner             | Status                      |
| ------------------------------------------------- | ----------------- | --------------------------- |
| identity/basic profile and consent                | `user-service`    | implemented source tree     |
| canonical destination metadata                    | `place-service`   | implemented source tree     |
| onboarding answers and derived preference context | `context-service` | planned; new approved slice |
| AI planning read                                  | `ai-service`      | implemented source tree     |
| browser flow                                      | Web               | implemented source tree     |

## Flow

```text
Web -> Gateway -> User: basic profile and consent
Web -> Gateway -> Context: versioned onboarding answers
Web -> Gateway -> User: account onboarding-gate eligibility
Context -> Place: validate canonical destination references
Context -> Kafka: PreferenceProfileChanged (versioned, no raw sensitive values)
AI -> Context: purpose-scoped preference context
```

User Service owns identity and consent. Context owns onboarding answers, normalized selections and derived signals. AI uses a Context API, not persistence or events as a query layer. Place remains authoritative for names/categories; no cross-service database reads or JPA relations exist.

Context owns the authoritative lifecycle (`NOT_STARTED` represented by no profile, `IN_PROGRESS`, `COMPLETED`) for every account. The browser gate reads Context before rendering `UserLayout`; it fails closed when the lifecycle is unavailable. `user-service.onboarding_required` becomes a temporary compatibility field and must not decide access once this rollout is deployed.

Context implementation follows the [backend code design](backend-code-design.md): domain/application/adapters separation, ports for external concerns and a transactional outbox. This is deliberately a pragmatic feature module, not a repository-wide rewrite.

## Communication

The browser writes synchronously so it can show validation and resume state. Context validates supplied place references synchronously through Place or a bounded projection. Preference-change events are asynchronous for AI cache invalidation and future consumers. Calendar OAuth, voice selection and voice recording are separate integrations and do not belong in this initial write path.
