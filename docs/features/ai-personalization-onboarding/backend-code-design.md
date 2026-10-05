# Backend Code Design

## Design style

Use a pragmatic hexagonal structure in `context-service`. Business rules stay independent of Spring, JPA, HTTP and Kafka. Do not introduce generic framework abstractions where one feature-specific port is clearer.

```text
context-service/
  onboarding/
    domain/          # aggregate, value objects, invariants, domain events
    application/     # commands, queries, use cases, ports
    adapter/in/web/  # REST controllers and request/response DTOs
    adapter/out/persistence/ # JPA entities, repositories, mappers
    adapter/out/place/       # Place validation adapter
    adapter/out/messaging/   # transactional outbox publisher
  shared/            # JWT principal, errors, clock, idempotency only
```

Dependencies point inward: Web/Persistence/Place/Messaging adapters depend on Application and Domain; Domain depends on neither adapters nor Spring. Cross-feature reuse is limited to `shared` primitives with a real common invariant.

## Domain model

`OnboardingProfile` is the aggregate root. It owns profile status, optimistic version, consent revision, selections, attributes and place preferences. It exposes intention-revealing methods:

- `replaceSelections(dimension, values)`
- `setAttribute(attribute, validatedValue)`
- `replacePlaces(intent, placeRefs)`
- `grantConsent(scope, revision)` / `revokeConsent(scope)`
- `complete()` / `skip()` / `erase()`

`PreferenceDimension` is a catalog-backed value object: code, cardinality, sensitivity and AI eligibility. The catalog is loaded through a read port and is the single validation authority. Controllers never decide which values are valid.

## Application use cases

One public class per use case, named by user intent rather than a technical verb:

| Use case                  | Input                     | Output                   |
| ------------------------- | ------------------------- | ------------------------ |
| `GetOnboardingProfile`    | authenticated user        | profile view             |
| `UpdateOnboardingProfile` | versioned command         | profile view             |
| `CompleteOnboarding`      | idempotency key + version | completed view           |
| `DeleteOnboardingData`    | authenticated user        | no content               |
| `GetAiPreferenceContext`  | user + purpose            | purpose-filtered signals |

Commands are immutable records. A command handler loads the aggregate through `OnboardingProfileRepository`, invokes domain methods, saves once in a transaction, and appends an outbox event. Queries use read ports/projections and never mutate state.

## Ports

- `OnboardingProfileRepository`: load/save aggregate only.
- `PreferenceCatalogPort`: resolve allowed dimensions/value codes and value schemas.
- `PlaceReferencePort`: validate canonical place references in bounded batches.
- `PreferenceSignalPort`: replace derived signals for a specific source profile version.
- `OutboxPort`: append an event in the same transaction.
- `Clock`: deterministic timestamps in tests.

JPA entities, Spring Data repositories, RestClient and Kafka templates remain adapter details. No controller returns a JPA entity; map explicitly at adapter boundaries.

## Error and transaction policy

- Use typed domain errors: `StaleProfileVersion`, `InvalidPreferenceValue`, `ConsentRequired`, `InvalidPlaceReference`, `OnboardingAlreadyCompleted`.
- A Web exception mapper converts them once to the documented API envelope/status; never leak database exceptions.
- Use one transaction per write use case. The outbox row is written in that transaction; publishing is retried separately.
- `If-Match` version protects overwrite races. Completion is keyed by user + idempotency key + command fingerprint.
- Deletion writes an audit-safe deletion event and schedules sensitive-text purge; it does not leave stale AI signals.

## Extension rules

1. Add a new catalog dimension/value code first.
2. Add a value object only when the field has behavior beyond catalog validation.
3. Add a new attribute schema version rather than changing meaning of an existing attribute.
4. Add a new AI purpose allowlist rather than widening the default context.
5. Add a migration for every persistent structure change; never use JPA `ddl-auto` for schema creation.

## Test structure

- Domain unit tests: aggregate invariants, consent, version transitions and signal derivation.
- Application tests: commands, idempotency, transaction/outbox behavior through fake ports.
- Adapter integration tests: JPA mappings/migrations, Place client failures, JWT ownership and API errors.
- Contract tests: Context-to-AI response is purpose-scoped and stable.

Avoid controller-only tests as the main coverage mechanism; they do not protect domain rules.
