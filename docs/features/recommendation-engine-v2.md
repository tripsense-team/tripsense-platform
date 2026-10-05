# Recommendation Engine V2 — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/recommendation-service`
- **Affected Components**: `services/recommendation-service`, `services/place-service`, `services/context-service`, `services/trip-service`, `services/user-service`, `services/api-gateway`, `services/ai-service`, root Maven reactor, Docker Compose
- **Created Date**: 2026-09-24
- **Completed Date**: 2026-09-25
- **Delivery Note**: the user subsequently approved continuation through all implementation phases; production model activation and data-backed rollout evaluation remain explicit operational follow-ups

---

## 0. Repository Audit

### 0.1 Current architecture discovered

| Component | Current repository state | Relevant convention / ownership |
| --- | --- | --- |
| Root build | Java 21, Spring Boot `4.1.0`, Spring Cloud `2025.1.2`, Maven multi-module reactor | New Java service must be added as a root Maven module and use the parent BOM |
| API Gateway | Implemented; Java `RouteLocator`; Eureka `lb://...`; Redis rate limiting | All public `/api/recommendations/**` traffic must route through Gateway |
| Discovery Server | Implemented on `8761` | Java services register with Eureka |
| `place-service` | Implemented; MongoDB, Redis, ZioMap provider, port configured as `8082` in Compose | Owns canonical Place data, provider access, persistence, freshness, search and retrieval ranking |
| `context-service` | Implemented; PostgreSQL/Flyway; typed derived preference signals; JWT-protected | Authoritative owner of consented, purpose-scoped preference signals and future observed preference signals |
| `user-service` | Implemented; PostgreSQL; identity/profile plus a compatibility `travel_preferences` JSON API | Owns identity and personalization consent; must not become the recommendation feature store |
| `trip-service` | Implemented; PostgreSQL/Flyway and Redis; JWT ownership checks | Owns trip destination, dates, party, budget, itinerary and trip membership/ownership |
| `ai-service` | Implemented FastAPI service | Currently calls Place retrieval and performs a deterministic final ranking in Python; this is transitional and overlaps the V2 target boundary |
| Redis | Shared deployment infrastructure; each service owns its key namespace | Disposable cache/session acceleration only; never durable feedback source of truth |
| Kafka | Described in architecture docs but no broker or Spring Kafka dependency exists in the checked-in deployment | Do not claim or require Kafka until an independently reviewed infrastructure change introduces it |
| Docker | Development and production Compose exist; no recommendation database or Qdrant | Phase 1 adds no Qdrant, embedding provider, Kafka, or recommendation database |

Repository architecture documentation is stale where it labels `user-service` and `context-service` as planned; both are present in the current source tree. Implementation must follow current code and update shared architecture documentation in the phase that introduces the new service.

### 0.2 Exact current `PlaceSearchService.recommend(...)` flow

```text
POST /api/places/recommendations
  -> PlaceController validates Bean constraints and the lat/lng pair
  -> PlaceSearchServiceImpl.recommend(request)
     -> no location anchor:
          Mongo $text search only -> DTO mapping -> evidence -> INSUFFICIENT
     -> location anchor present:
          Redis search cache
          -> retrieval re-rank -> evidence -> return if SUFFICIENT
          -> otherwise Mongo $text search
             -> DTO mapping -> retrieval re-rank -> evidence
             -> return if SUFFICIENT or refresh is disabled
             -> otherwise ZioMap text search
                -> idempotent Mongo upsert
                -> merge/deduplicate provider + local results
                -> retrieval re-rank -> evidence -> Redis cache
     -> enrich candidate photos, with provider gallery fallback where needed
  -> ApiResponse<PlaceRecommendationResult>
```

#### Candidate sources

1. **Redis cache** uses a centralized hashed key derived from normalized query, rounded coordinates, radius and limit.
2. **Local MongoDB** uses `PlaceRepository.searchByText(...)`; the recommendation path requests up to `targetCount * 2` candidates.
3. **External provider** is called only when anchored local evidence is insufficient and external refresh is allowed. Broad categories may be enriched with an inferred Da Nang district before the provider call.

The current recommendation path does not independently combine lexical, geo and popular lists. It is one Place-owned retrieval operation with cache/local/provider fallbacks.

#### Merge, persistence and deduplication

- Provider results are normalized by the provider adapter and passed to `PlacePersistenceService.upsertProviderPlace(...)`.
- Persistence first matches `(provider, providerPlaceId)`.
- A new provider place may reuse one unambiguous stored place when normalized name and address match and coordinates are within 100 metres.
- If Mongo is unavailable, persistence returns the normalized provider DTO with a fallback ID rather than failing retrieval.
- The final in-memory merge prefers provider results and deduplicates by `provider:providerPlaceId`, then canonical ID, then name.

#### Retrieval ranking

`PlaceRankingServiceImpl` is a deterministic retrieval ranker. It:

- filters zero-text-match candidates for specific queries;
- scores text match, raw rating, logarithmic review count and stepped Haversine proximity;
- returns an ordered `List<PlaceDto>`.

This contract remains in `place-service`. It answers “which places are good retrieval candidates?”, not “which candidates are best for this user/trip?”. It must not be merged with the V2 `Ranker` contract.

#### Refresh and freshness

- Search-level local staleness uses a hard-coded 30-day threshold.
- DTO mapping derives freshness from the configurable provider cache TTL.
- The recommendation path decorates freshness again using request `maximumAgeSeconds`.
- A provider refresh is performed only after cache and local evidence fail sufficiency and `allowExternalRefresh` is not false.
- Provider failure returns local candidates with `providerStatus=UNAVAILABLE`, `status=INSUFFICIENT` and reason `PROVIDER_UNAVAILABLE`; it does not fail the entire recommendation request.

#### `RetrievalEvidenceDto` construction

`assess(...)` calculates:

- candidate and eligible counts;
- per-required-field coverage;
- geographic coverage as the proportion with coordinates;
- aggregate freshness;
- source set, provider status, refresh flag and retrieval timestamp;
- reason codes such as `TOO_FEW_CANDIDATES`, `MANDATORY_FIELD_MISSING:*`, `WEAK_GEOGRAPHIC_COVERAGE`, `STALE_REQUIRED_EVIDENCE`;
- hard-coded retrieval ranking version `place-rank-v2`.

No-anchor requests additionally force `LOCATION_ANCHOR_UNRESOLVED` and zero geographic coverage.

#### Important limitations V2 must not misinterpret

- `radiusMeters` scopes provider search but local text candidates are not hard-filtered by radius.
- `geographicCoverage` means “has coordinates”, not “is inside the requested radius”.
- `requiredFields` influence sufficiency/eligibility evidence, but the returned candidate list is not reduced to eligible candidates.
- Source evidence is aggregate; it does not provide a per-candidate source rank/score suitable for true multi-list RRF.
- Photo enrichment can trigger provider calls per returned candidate and therefore affects latency independently of retrieval.
- `PlaceSearchServiceImpl`, `PlaceRankingServiceImpl` and `PlacePersistenceServiceImpl` each contain geo calculations for different current purposes. V2 must have one recommendation-owned geo calculation without changing Place persistence semantics in the first phase.

### 0.3 Existing code to reuse

| Existing capability | Reuse decision |
| --- | --- |
| `POST /api/places/recommendations` | Keep backward-compatible and consume as the first Place candidate generator in Phase 2 |
| `PlaceRecommendationRequest`, `PlaceRecommendationResult`, `RetrievalEvidenceDto`, `PlaceDto` JSON | Mirror as recommendation-service HTTP adapter DTOs; do not add Java module coupling |
| `PlaceRankingService` | Preserve unchanged as retrieval ranking |
| `PlaceProvider`, persistence and freshness logic | Remain encapsulated inside `place-service` |
| Context `GET /api/context/preferences` | Preferred consented preference source after an internal/purpose contract is agreed; no DB access |
| Trip `GET /api/trips/{tripId}` | Reuse with propagated user authorization so Trip enforces ownership |
| Existing JWT/current-user pattern | Reuse conceptually; derive user identity from the validated access token, not request `userId` |
| Existing `ApiResponse` and safe exception translation pattern | Follow the envelope/error-code convention while avoiding raw downstream errors |
| Existing `RestClient` convention | Use typed outbound adapters with configured timeouts; never leak service DTOs into domain packages |
| Existing Redis infrastructure | Use a recommendation-owned prefix and centralized key factory only in a later cache phase |

### 0.4 Existing code that conflicts with or overlaps V2

1. `services/ai-service/app/recommendation/ranker.py` currently performs final hard filtering, feature scoring and simple category diversification after Place retrieval. It is the current behavior and must remain until V2 is functional, but its final-ranking responsibility migrates to `recommendation-service`; formulas must not be copied into both services.
2. `ai-service` currently reads `user-service /api/users/me/travel-preferences`; the approved onboarding architecture makes `context-service` the long-term owner of purpose-scoped derived signals. V2 needs one normalized `UserProfileProvider` adapter boundary and an explicit compatibility/fallback policy.
3. The Place method name `recommend(...)` is misleading but already used by `ai-service`. It remains unchanged and is documented as candidate retrieval.
4. Place retrieval evidence is aggregate and insufficient for multi-source per-candidate RRF evidence. Phase 2 first preserves it verbatim; any additive per-candidate evidence contract is a separate compatible Place API evolution.
5. No durable recommendation feedback store, recommendation DB, Kafka broker, vector store, embedding client or trained LTR artifact exists. V2 must not pretend otherwise.

### 0.5 Phase 1 proposed files

The exact package layout may be adjusted during implementation only to match compiler/framework constraints; responsibilities may not be collapsed into a god service.

**Add under `services/recommendation-service`:**

```text
pom.xml
Dockerfile
src/main/java/fu/tripsense/recommendation/RecommendationServiceApplication.java
src/main/java/fu/tripsense/recommendation/api/RecommendationController.java
src/main/java/fu/tripsense/recommendation/api/RecommendationExceptionHandler.java
src/main/java/fu/tripsense/recommendation/api/dto/RecommendationRequest.java
src/main/java/fu/tripsense/recommendation/api/dto/RecommendationResponse.java
src/main/java/fu/tripsense/recommendation/application/RecommendationApplicationService.java
src/main/java/fu/tripsense/recommendation/application/CandidateRetrievalPipeline.java
src/main/java/fu/tripsense/recommendation/application/CandidateFilterPipeline.java
src/main/java/fu/tripsense/recommendation/application/FeaturePipeline.java
src/main/java/fu/tripsense/recommendation/application/port/CandidateGenerator.java
src/main/java/fu/tripsense/recommendation/application/port/CandidateFusionStrategy.java
src/main/java/fu/tripsense/recommendation/application/port/CandidateFilter.java
src/main/java/fu/tripsense/recommendation/application/port/FeatureExtractor.java
src/main/java/fu/tripsense/recommendation/application/port/Ranker.java
src/main/java/fu/tripsense/recommendation/application/port/Diversifier.java
src/main/java/fu/tripsense/recommendation/domain/... (typed immutable models listed in §2.4)
src/main/java/fu/tripsense/recommendation/config/RecommendationProperties.java
src/main/java/fu/tripsense/recommendation/config/AlgorithmVersionCatalog.java
src/main/resources/application.yaml
src/test/java/... focused contract/orchestration/configuration tests
```

Phase 1 must keep the public recommendation route disabled unless a complete, non-fabricated pipeline is configured. It may expose health only. This avoids returning fake “recommendations” from placeholder algorithms.

**Modify in Phase 1:**

- root `pom.xml`: add the module;
- shared architecture/service documentation: mark the service as implemented skeleton after it exists;
- no Place application source file;
- no Gateway route, Compose service, database or external infrastructure until the Phase 2 path is functional.

### 0.6 Dependency and Docker assessment

- Phase 1 dependencies: Spring Web, Validation, Actuator, Eureka client, Spring Security/JWT support consistent with current services, configuration processor, test starter. No JPA, Mongo, Redis, Qdrant, Kafka, embedding or LightGBM dependency.
- Phase 2 adds only HTTP client/configuration needed for Place integration and then enables Gateway/Compose wiring.
- Phase 7 may add a recommendation-owned PostgreSQL database and Flyway after its schema is separately reviewed.
- Phase 6 may add Qdrant only after the semantic design and operational budget are approved.
- No Docker changes are authorized by this plan before the corresponding implementation phase.

### 0.7 Audit conclusion

There is no architectural reason to reject a dedicated `recommendation-service`, provided preference ownership is aligned with `context-service`, the current AI ranking is migrated rather than duplicated, and Phase 1 remains contracts-only. Repository policy still requires human approval before Phase 1 application code begins.

---

## 1. Goal & Requirements

### 1.1 Goal

Create an incremental, production-oriented Recommendation Engine V2 that personalizes canonical Place candidates for the authenticated traveler and optional owned trip. It must work deterministically in cold start before semantic retrieval, feedback learning or a trained LTR model exists.

### 1.2 In scope

- A dedicated recommendation orchestration boundary.
- Replaceable candidate generation, fusion, hard filtering, feature extraction, ranking and diversification contracts.
- Initial Place-owned candidate retrieval integration and preservation of upstream evidence.
- RRF for genuinely independent ranked lists.
- Strongly typed features, explainable heuristic ranking and cold-start fallback.
- Later semantic retrieval, feedback/impressions, multi-timescale profiles, MMR and offline evaluation through explicitly staged work.
- Algorithm/data version traceability and graceful degradation.

### 1.3 Out of scope for the first approved implementation run

- Qdrant, embeddings or embedding caches.
- Durable feedback/impression persistence.
- Redis recommendation-result/session-profile caching.
- MMR implementation.
- LightGBM/LambdaMART runtime or training scripts.
- Kafka infrastructure.
- Changes to `Place.java`, Place persistence ownership, or existing Place endpoint names.
- Replacing the active `ai-service` ranker before the new end-to-end path is verified.

### 1.4 Domain invariants

1. `place-service` owns Place data and retrieval quality; `recommendation-service` never reads MongoDB.
2. `PlaceRankingService` and recommendation `Ranker` are different stages and remain separate.
3. `PlaceSearchService.recommend(...)` remains backward-compatible candidate retrieval.
4. Authenticated user identity comes from JWT. A body `userId` is forbidden on the public API.
5. A supplied `tripId` is used only after Trip verifies the current user's access.
6. Hard constraints exclude candidates; unavailable optional signals degrade to neutral/fallback behavior and are recorded as evidence.
7. Feature calculations have one authoritative implementation. Rankers consume features and never recalculate them.
8. LLMs may verbalize typed reason codes but never select or reorder candidates.
9. No trained model is claimed without a versioned real artifact and compatible feature schema.
10. Every served result set has one immutable `recommendationId` and algorithm version bundle.
11. Redis is never the durable source of impression/feedback truth.
12. `RecommendationApplicationService` orchestrates only; algorithm and adapter logic live in focused collaborators.

### 1.5 Acceptance criteria

- [x] Phase 1 compiles in the root reactor and passes focused tests without Qdrant, DB, Redis or ML infrastructure.
- [x] Phase 2 can return cold-start results from Place retrieval while preserving all `RetrievalEvidenceDto` fields internally.
- [x] One optional generator failure does not fail a request when another generator yields valid candidates.
- [x] Duplicate Place IDs from multiple generators fuse into one candidate with per-source evidence.
- [x] Hard filters are tested separately from weighted features.
- [x] Mathematical functions (RRF, Bayesian quality, log popularity, distance/decay, temporal decay, MMR and metrics) each have one implementation and edge-case tests when their phase is delivered.
- [x] Different contexts can produce different deterministic rankings for the same candidates after Phase 5.
- [x] Existing `/api/places/**` behavior and the AI caller remained compatible until the explicit Phase 10 migration.
- [x] No controller contains recommendation business logic and no orchestration class owns formulas, HTTP mapping, persistence or cache key construction.

---

## 2. Architecture & Service Boundaries

### 2.1 Target flow

```text
Client / AI Service
        |
        v
API Gateway -> RecommendationController
        |
        v
RecommendationApplicationService
        +-> RecommendationContextResolver
        |     +-> Context service (consented preference signals)
        |     +-> Trip service (owned trip context)
        |     `-> User service (identity/consent only when required)
        +-> CandidateRetrievalPipeline
        |     +-> CandidateGenerator[]
        |     `-> CandidateFusionStrategy (RRF when 2+ real lists exist)
        +-> CandidateFilterPipeline
        +-> FeaturePipeline -> FeatureExtractor[]
        +-> Ranker (Heuristic first; LTR later)
        +-> Diversifier (pass-through until MMR phase)
        `-> ImpressionRecorder (durable only from Phase 7)
```

### 2.2 Ownership

| Component | Owns | Must not own |
| --- | --- | --- |
| `place-service` | canonical Place, provider integration, enrichment, freshness, lexical/geo retrieval, retrieval ranking/evidence | user/trip profile, feedback learning, final personalized rank, MMR |
| `context-service` | consented typed preference signals and profile lifecycle | recommendation impressions or Place data |
| `trip-service` | trip lifecycle, ownership, destination, itinerary | recommendation feature store |
| `user-service` | identity, authorization facts, consent compatibility | final rank or duplicate derived profile truth |
| `recommendation-service` | orchestration, fusion, hard filters, feature engineering, personalized rank, versions, recommendation evidence, impressions/feedback and derived observed profiles | Place persistence/provider refresh, direct foreign DB reads, LLM text generation |
| `ai-service` | conversational orchestration and optional reason-code verbalization | long-term final ranking after V2 migration |

### 2.3 Communication

- Public request: synchronous REST through Gateway.
- Place/context/trip reads: synchronous typed REST because the response needs them immediately; use strict per-adapter timeout budgets.
- Forward the end-user bearer token to Context/Trip for ownership and consent enforcement until a reviewed service-to-service identity standard exists.
- Feedback ingestion: synchronous idempotent REST in Phase 7, committed to the recommendation database before acknowledgement.
- Async profile updates/export: use an outbox first. Publish to Kafka only after Kafka exists and its delivery semantics are approved.

### 2.4 Internal typed domain model

Phase 1 establishes immutable records/value types, without algorithm implementations that fabricate behavior:

```java
record RecommendationContext(
    UUID requestId,
    UUID userId,
    UUID tripId,
    String sessionId,
    RecommendationIntent intent,
    GeoAnchor anchor,
    Set<String> preferredCategories,
    Set<String> dislikedCategories,
    UserProfileSnapshot profile,
    TripContextSnapshot trip,
    int limit) {}

record Candidate(
    String placeId,
    CandidateSource source,
    int sourceRank,
    Double sourceScore,
    PlaceSnapshot place,
    RetrievalEvidence sourceEvidence) {}

record FusedCandidate(
    String placeId,
    PlaceSnapshot place,
    double fusionScore,
    List<CandidateSourceEvidence> sources) {}

record CandidateFeatures(
    String placeId,
    RetrievalFeatures retrieval,
    SemanticFeatures semantic,
    PreferenceFeatures preference,
    GeographicFeatures geographic,
    QualityFeatures quality,
    ContextFeatures context,
    HistoryFeatures history,
    FeatureMetadata metadata) {}

record RankedCandidate(
    CandidateFeatures features,
    double score,
    ScoreBreakdown breakdown,
    List<RecommendationReason> reasons) {}
```

Absent features are represented explicitly (`OptionalDouble`, nullable boundary fields mapped once, or availability flags), not silently converted into positive evidence. Internal models must not use `Map<String,Object>` for feature vectors.

### 2.5 Algorithm boundaries

```java
interface CandidateGenerator {
  CandidateGenerationResult generate(RecommendationContext context);
}

interface CandidateFusionStrategy {
  List<FusedCandidate> fuse(List<CandidateGenerationResult> sources);
}

interface CandidateFilter {
  FilterDecision evaluate(RecommendationContext context, FusedCandidate candidate);
}

interface FeatureExtractor {
  FeatureContribution extract(RecommendationContext context, FusedCandidate candidate);
}

interface Ranker {
  List<RankedCandidate> rank(
      RecommendationContext context, List<CandidateFeatures> candidates);
}

interface Diversifier {
  List<RankedCandidate> diversify(
      RecommendationContext context, List<RankedCandidate> ranked, int limit);
}
```

`FeaturePipeline` is the only component allowed to assemble `CandidateFeatures`. Extractors own disjoint typed feature groups so the same formula is never implemented twice.

### 2.6 Failure and degradation matrix

| Failure | Required behavior |
| --- | --- |
| Invalid request | `400 INVALID_RECOMMENDATION_REQUEST` with safe field errors |
| Invalid/expired token | `401`; no anonymous personalized fallback on the authenticated endpoint |
| Unauthorized trip | privacy-safe `404` or existing Trip authorization status; do not continue with that trip silently |
| Place unavailable and no other generator succeeds | `503 CANDIDATE_RETRIEVAL_UNAVAILABLE` |
| Place returns zero valid candidates | successful empty result with `NO_CANDIDATES`, not a fabricated list |
| Optional semantic/vector generator unavailable | continue with Place/popular sources; record degradation code |
| Context profile unavailable | cold-start fallback; record `PROFILE_UNAVAILABLE` without logging profile content |
| User has personalization disabled | do not read/use profile; use intent/context/popularity only |
| One feature extractor lacks data | mark feature unavailable/neutral according to versioned policy; do not drop candidate unless it is a hard constraint |
| Impression persistence fails once Phase 7 is mandatory | fail closed before returning an untrackable ranked list, or use a durable outbox in the same transaction; decision finalized in Phase 7 |

---

## 3. API & Event Contracts

### 3.1 Public recommendation API

```http
POST /api/recommendations
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "query": "quiet cafes for remote work",
  "tripId": "0d7f8169-f36f-4c3c-b0a9-3f8c7b105735",
  "sessionId": "web-session-opaque-id",
  "lat": 16.0544,
  "lng": 108.2022,
  "radiusMeters": 5000,
  "preferredCategories": ["cafe"],
  "dislikedCategories": ["bar"],
  "limit": 10
}
```

Rules:

- `query`: optional only when trip/geo/category intent is sufficient; if present, trimmed length `1..200`.
- no public `userId`; identity is derived from JWT.
- `tripId`: optional UUID and ownership-checked.
- `sessionId`: optional opaque value, maximum 128 characters, allowlisted characters; not an authentication credential.
- latitude and longitude must appear together and use valid ranges.
- `radiusMeters`: `100..50_000`; `limit`: `1..50`.
- category lists: normalized bounded codes, maximum 20 each; the same value cannot be both preferred and disliked.
- body preferences are request-scoped hints, never persisted account preferences.

```json
{
  "success": true,
  "data": {
    "recommendationId": "1fa4d248-4431-4e13-810f-b84464eb25fd",
    "items": [
      {
        "place": { "id": "canonical-place-id", "name": "Example", "categories": ["cafe"] },
        "rank": 1,
        "score": 0.8124,
        "scoreBreakdown": {
          "retrieval": 0.18,
          "semantic": 0.0,
          "preference": 0.22,
          "geographic": 0.16,
          "quality": 0.17,
          "context": 0.0824,
          "popularity": 0.0,
          "finalScore": 0.8124
        },
        "reasonCodes": ["MATCHES_USER_PREFERENCE", "NEAR_TRIP_AREA"]
      }
    ],
    "versions": {
      "retrieval": "place-retrieval-v2",
      "fusion": "rrf-v1",
      "embedding": "none",
      "feature": "features-v1",
      "ranking": "heuristic-v1",
      "diversity": "none"
    },
    "degradations": []
  }
}
```

Public responses expose stable reason codes and bounded score groups, not raw embeddings, full profiles, model internals, provider errors or arbitrary feature maps. Detailed upstream evidence is retained in internal records/log-correlated storage and may be exposed only through an authenticated operator/debug contract designed later.

### 3.2 Existing Place contract remains unchanged

```http
POST /api/places/recommendations
```

No rename or removal is planned. Add documentation/Javadoc in Phase 2 only if needed:

```java
/** Retrieves and ranks place candidates suitable for downstream recommendation processing. */
PlaceRecommendationResult recommend(PlaceRecommendationRequest request);
```

The recommendation service defines local transport DTO equivalents with `@JsonIgnoreProperties(ignoreUnknown = true)` and contract tests. It does not depend on Place Java DTO classes.

### 3.3 Feedback API reserved for Phase 7

```http
POST /api/recommendations/{recommendationId}/events
Idempotency-Key: <uuid>
Authorization: Bearer <access-token>
```

```json
{
  "placeId": "canonical-place-id",
  "eventType": "CLICK",
  "position": 1,
  "occurredAt": "2026-09-24T10:00:00Z"
}
```

Allowed types: `IMPRESSION`, `CLICK`, `DETAIL_VIEW`, `LIKE`, `DISLIKE`, `SAVE`, `UNSAVE`, `ADD_TO_TRIP`, `REMOVE_FROM_TRIP`, `BOOKING_CLICK`.

The server resolves user/trip/session/ranking/feature versions from the stored impression, verifies the place and position were shown, bounds client clock skew, and deduplicates by `(user_id, idempotency_key)`. Clients cannot submit weights, labels, another user ID or ranking versions.

### 3.4 Internal downstream contracts

Personalization erasure is authenticated and user-scoped:

```http
DELETE /api/recommendations/personalization-data
Authorization: Bearer <access-token>
```

It removes the authenticated user's recommendation impressions, feedback, impression items through cascade, and matching unpublished/published outbox payloads owned by this service. The AI compatibility endpoint proxies this operation before deleting its legacy local records.

- Place: existing recommendation retrieval endpoint in Phase 2.
- Context: current `GET /api/context/preferences?purpose=TRIP_PLANNING` is user-token scoped. Before using it for V2, add/approve `purpose=PLACE_RECOMMENDATION` or explicitly document why `TRIP_PLANNING` is semantically valid; do not silently overload purpose.
- Trip: existing `GET /api/trips/{tripId}` with bearer propagation.
- User: personalization consent/compatibility endpoint only when required; preference values should converge on Context rather than be joined from two authorities.

### 3.5 Event/export contracts

No Kafka event is introduced in Phases 1–6. Phase 7 writes a transactional outbox record suitable for a future versioned event:

```json
{
  "eventId": "uuid",
  "eventType": "RECOMMENDATION_FEEDBACK_RECORDED",
  "schemaVersion": 1,
  "occurredAt": "instant",
  "payload": {
    "recommendationId": "uuid",
    "userId": "uuid",
    "placeId": "string",
    "interactionType": "CLICK",
    "position": 1,
    "rankingVersion": "heuristic-v1",
    "featureVersion": "features-v1"
  }
}
```

Raw profile content, query text and embeddings are excluded by default. Offline LTR export reads a controlled database export, grouped by recommendation/request ID, and is not embedded in Spring ranking logic.

---

## 4. Data Model & Migrations

### 4.1 Phase 1

No database and no migration. Domain records are in memory only; no impression claim is made until durable recording exists.

### 4.2 Proposed Phase 7 recommendation-owned PostgreSQL schema

```sql
CREATE TABLE recommendation_impression (
  recommendation_id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  trip_id UUID NULL,
  session_id VARCHAR(128) NULL,
  query_hash VARCHAR(64) NULL,
  retrieval_version VARCHAR(80) NOT NULL,
  fusion_version VARCHAR(80) NOT NULL,
  embedding_version VARCHAR(80) NOT NULL,
  feature_version VARCHAR(80) NOT NULL,
  ranking_version VARCHAR(80) NOT NULL,
  diversity_version VARCHAR(80) NOT NULL,
  degradation_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_recommendation_impression_user_created
  ON recommendation_impression (user_id, created_at DESC);

CREATE TABLE recommendation_impression_item (
  recommendation_id UUID NOT NULL REFERENCES recommendation_impression(recommendation_id),
  place_id VARCHAR(200) NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  final_score DOUBLE PRECISION NOT NULL,
  source_evidence JSONB NOT NULL,
  feature_snapshot JSONB NOT NULL,
  reason_codes JSONB NOT NULL,
  PRIMARY KEY (recommendation_id, place_id),
  UNIQUE (recommendation_id, position)
);

CREATE TABLE recommendation_feedback_event (
  event_id UUID PRIMARY KEY,
  idempotency_key UUID NOT NULL,
  recommendation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  trip_id UUID NULL,
  session_id VARCHAR(128) NULL,
  place_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  ranking_version VARCHAR(80) NOT NULL,
  feature_version VARCHAR(80) NOT NULL,
  UNIQUE (user_id, idempotency_key),
  FOREIGN KEY (recommendation_id, place_id)
    REFERENCES recommendation_impression_item(recommendation_id, place_id)
);

CREATE INDEX idx_feedback_user_occurred
  ON recommendation_feedback_event (user_id, occurred_at DESC);
CREATE INDEX idx_feedback_place_occurred
  ON recommendation_feedback_event (place_id, occurred_at DESC);

CREATE TABLE recommendation_outbox (
  event_id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NULL
);
```

`feature_snapshot` has a schema governed by `feature_version`; JSONB is acceptable at the durable interoperability/export boundary, not as the in-process feature model. Retention, partitioning and query redaction must be approved before Phase 7 migration. There are no cross-service foreign keys.

### 4.3 Profile and embedding storage

- Long-term observed profile aggregates may be recommendation-owned derived data, rebuilt from durable feedback.
- Consented declared preferences remain Context-owned and are referenced as snapshots with source/version/freshness.
- Session profile may be cached in Redis but must be recoverable or safely discardable.
- Place embeddings live in a vector store/embedding metadata store keyed by canonical `placeId`, `embeddingModel`, `embeddingVersion`, `contentHash`, `updatedAt`; no fields are added to `Place.java`.

### 4.4 Migration and rollback

- Flyway additive migrations only.
- Deploy schema before enabling Phase 7 writers.
- Roll back application readers/writers first; retain tables for forensic/export compatibility.
- Destructive table/column removal requires a later approved migration after retention/export obligations are met.

---

## 5. Feature, Ranking and Version Design

### 5.1 Candidate fusion

`ReciprocalRankFusionStrategy` uses one authoritative calculation:

```text
RRF(d) = sum(1 / (k + sourceRank(d)))
```

`k`, source candidate limits and source enablement are configuration. Fusion deduplicates by canonical Place ID and retains every contributing source/rank/score/evidence. RRF is applied only to independent ranked source lists; cache/local/provider fallbacks inside one Place response are not falsely treated as three lists.

### 5.2 Hard filters

Initial filters are separate `CandidateFilter` implementations for:

- supported/canonical Place state;
- explicit category/user exclusions;
- destination/city when authoritative values exist;
- maximum Haversine radius when both anchor and coordinates exist;
- mandatory fields;
- business status using an allow/deny policy with unknown handling.

Time/opening filtering stays unavailable until normalized timezone-aware opening hours exist. Unparsed `openingHours` cannot prove an `OPEN_AT` constraint.

### 5.3 Authoritative feature calculations

| Feature | Formula / policy |
| --- | --- |
| Retrieval | fused RRF score, source count and adapter-provided lexical score when valid |
| Preference | normalized set overlap and explicit dislike conflict; typed category taxonomy required |
| Distance | one recommendation-owned Haversine calculator |
| Distance decay | `exp(-distanceKm / tau)`; configurable `tau > 0` |
| Bayesian quality | `(v/(v+m))*R + (m/(v+m))*C`; configurable prior `C` and threshold `m > 0` |
| Popularity | `log1p(max(0, reviewCount))`, normalized by versioned policy before weighting |
| Context | destination/trip/session matches only when backed by typed evidence |
| History | seen/saved/added/negative flags from durable known events; unavailable before Phase 7 |
| Semantic | cosine/similarity supplied through semantic ports; unavailable before Phase 6 |

Null rating, zero review count and missing coordinates produce explicitly unavailable/neutral features, never exceptions or fabricated values.

### 5.4 User profiles and temporal decay

```text
decayedWeight = configuredEventWeight * exp(-lambda * age)
combinedProfile = alpha * longTerm + beta * trip + gamma * session
```

All event weights, `lambda`, `alpha/beta/gamma`, horizons and minimum evidence thresholds are configuration properties validated at startup. Profile composition is behind `UserProfileProvider`/`ProfileComposer`. Cold start uses retrieval, request/trip context and quality/popularity only.

### 5.5 Ranker

`HeuristicRanker` computes a configurable weighted sum over already-extracted normalized features and produces `ScoreBreakdown` plus contribution-ranked reason codes. It does not calculate distance, quality, popularity or preference overlap.

Future `LightGbmRanker` implements the same `Ranker` contract and validates feature/model compatibility before activation. Missing or invalid model artifacts fall back to the heuristic ranker and emit an operational degradation; production code never creates training data or claims a fake model.

### 5.6 Diversity

Phase 8 `MmrDiversifier` uses:

```text
MMR(d) = lambda * relevance(d)
       - (1 - lambda) * maxSimilarity(d, selected)
```

Similarity is a port: embedding cosine when compatible embeddings exist, category similarity fallback otherwise. `lambda` is validated configuration. Until Phase 8, diversification is explicitly versioned `none`, not disguised as MMR.

### 5.7 Centralized versions

`AlgorithmVersionCatalog` supplies one immutable bundle per request:

- retrieval version from each generator/upstream evidence;
- fusion version;
- embedding model/version or `none`;
- feature schema version;
- ranking/model version;
- diversity version or `none`.

No algorithm writes literal version strings throughout business code.

---

## 6. Security & Trust Boundaries

| Risk | Required mitigation |
| --- | --- |
| User impersonation | Derive `userId` from verified access JWT; reject body/query user IDs |
| Trip IDOR | Forward authenticated identity and rely on Trip ownership/membership checks; never use unverified trip snapshots |
| Feedback poisoning | Require stored impression membership, valid shown position, idempotency key, enum event type, rate limits and clock-skew bounds |
| Profile privacy | Read purpose-scoped consented Context signals only; never log raw profile, free text, embedding or sensitive dietary/location values |
| Cross-service persistence | No direct Place/Context/User/Trip database access or cross-service JPA relationships |
| Secret leakage | Embedding/vector credentials remain backend environment secrets; public response/logs contain no credentials or raw downstream errors |
| Query/log leakage | Structured logs prefer IDs, counts, timings and versions; hash or omit raw query text |
| Debug evidence leakage | Detailed features/profile/source payloads require an operator-only future contract; public response is bounded |
| Abuse/cost | Gateway and service rate limits, request bounds, timeouts, candidate caps, circuit breaking and embedding cache |
| LLM fabrication | LLM receives stable reason codes and approved supporting values only; it cannot write scores/reasons |

Recommendation security should follow the current stateless JWT service pattern but must not copy the existing Context filter's stack-trace/`System.err` logging behavior. Authentication failures use safe structured logging.

---

## 7. Observability and Caching

### 7.1 Structured dimensions

- `recommendationId`, `requestId`, `tripId`, safe/pseudonymous user correlation;
- candidate count by generator, fused/filtered/ranked/output counts;
- context, retrieval, fusion, filtering, feature, ranking, diversity, persistence and total latency;
- cache hit/miss, downstream failure/degradation code;
- complete algorithm version bundle.

### 7.2 Metrics

- `recommendation_requests_total{status}`
- `recommendation_latency_seconds{stage}`
- `recommendation_candidates{stage,source}`
- `recommendation_downstream_failures_total{dependency}`
- `recommendation_cache_operations_total{cache,result}`
- `recommendation_degraded_total{reason}`

Metrics must avoid unbounded user/trip/recommendation labels.

### 7.3 Redis policy

Later cache keys are created only by `RecommendationCacheKeyFactory`, for example a versioned hash of non-sensitive context:

```text
recommendation:v2:result:<context-hash>
recommendation:v2:query-embedding:<model-version>:<query-hash>
recommendation:v2:session-profile:<session-hash>
recommendation:v2:user-profile:<user-hash>:<profile-version>
```

TTLs and prefixes are configuration. Personalized result cache keys must include profile/context/algorithm versions and must never allow one user to read another user's cached response.

---

## 8. Devil's Advocate & Trade-offs

| Risk / challenge | Decision and trade-off |
| --- | --- |
| New service increases latency and operations | Boundary is justified by distinct ownership; use bounded parallel downstream reads later, strict budgets and graceful optional-signal fallback |
| Context vs User preferences conflict | Context is target authority for typed derived signals; User remains identity/consent compatibility until migration is explicitly designed |
| AI ranker duplicates V2 | Keep it temporarily for compatibility, then switch its adapter to V2 and delete/deprecate duplicated formulas in the migration phase |
| RRF over one logical Place list is meaningless | Phase 2 uses Place as one generator; RRF becomes useful only when genuinely independent lists are available |
| Existing Place radius is not a hard constraint | Recommendation hard-filter stage recomputes authoritative distance from returned coordinates |
| Missing coordinates can bias results | Policy distinguishes “radius is mandatory” (exclude unknown) from no-radius context (neutral unavailable geo feature) |
| Postgres impression volume | Start normalized and indexed; approve retention/partitioning before high-volume rollout |
| Position bias | Always store impression position and recommendation ID; offline evaluation/training must account for exposure policy |
| Feedback retries/out-of-order events | Idempotency key, immutable impressions and received/occurred timestamps; state aggregates are derived, not destructive overwrites |
| Shared Redis failure | Cache is optional; durable behavior and correctness do not depend on it |
| Qdrant/provider outage | Semantic generator is optional and cannot bypass fusion; lexical/geo/quality fallback remains complete |
| Over-abstraction | Keep only algorithm/service boundary interfaces explicitly required for independent replacement; do not create one interface per trivial helper/value object |
| Premature public skeleton | Keep recommendation route disabled until Phase 2 supplies real candidates; health/compile prove Phase 1 |

Rejected alternatives:

1. Put personalization in `place-service`: violates data ownership and couples Place retrieval to users/trips/feedback.
2. Merge `PlaceRankingService` with V2 `Ranker`: conflates retrieval quality and personalized final ranking.
3. Keep final ranking in `ai-service`: prevents a deterministic reusable recommendation platform and risks LLM-adjacent ownership drift.
4. Build Qdrant/feedback/LTR in the first change: creates premature infrastructure and multiplies invalid assumptions.
5. One `RecommendationServiceImpl`: violates SRP and makes algorithms, I/O and persistence inseparable.
6. Share Place Java DTO module: creates compile-time service coupling; use versioned HTTP contracts and consumer contract tests.

---

## 9. Phased Implementation Tasks & Verification

Each phase is an independently reviewed change set. Do not continue automatically to the next phase.

### Phase 0 — Audit and approved design (this document)

- [x] Trace Place controller, search/provider/cache/ranking/persistence/evidence flow.
- [x] Audit build, discovery, Gateway, Redis, Docker and service-to-service conventions.
- [x] Identify Context/Trip/User ownership and current AI ranking overlap.
- [x] Specify contracts, phases, risks and non-goals.
- [x] Human approval.

### Phase 1 — Core contracts and bootable skeleton only

- [x] Add Maven module/application/configuration and health endpoint.
- [x] Add immutable domain models and algorithm ports from §2.4–2.5.
- [x] Add API DTOs/error taxonomy, but keep public business route disabled until a real retrieval pipeline exists.
- [x] Add thin orchestration/pipeline skeletons with no formulas and no fake algorithms.
- [x] Add centralized validated configuration/version catalog.
- [x] Add architecture tests preventing adapter/domain dependency inversion violations where practical.
- [x] Compile/package the full Maven reactor and test affected modules.
- [x] Report Phase 1 files, decisions and deferred work before continuation was approved.

### Phase 2 — Existing Place retrieval integration

- [x] Implement typed Place HTTP adapter and `PlaceServiceCandidateGenerator`.
- [x] Preserve every upstream retrieval evidence field internally.
- [x] Forward timeouts and classify invalid, unavailable, partial and empty outcomes.
- [x] Add a consumer contract test for the existing Place envelope.
- [x] Enable Gateway/Compose only after the endpoint returns real, non-fabricated cold-start results.
- [x] Preserve the Place API contract; migrate the AI caller only in Phase 10.

### Phase 3 — Multi-source retrieval and RRF

- [x] Add only real generators supported by available contracts; do not split one Place fallback chain into fake sources.
- [x] Implement RRF, canonical-ID deduplication and per-source evidence.
- [x] Implement optional-generator graceful degradation and latency budgets.
- [x] Confirm no additional Place lexical/geo/popular API is needed for this increment.

### Phase 4 — Feature pipeline

- [x] Add authoritative retrieval, preference, Bayesian quality, log popularity, geo distance/decay and available context extractors.
- [x] Add hard filters before feature extraction/ranking.
- [x] Keep unavailable semantic/history features explicit.

### Phase 5 — Heuristic ranking

- [x] Implement configuration-weighted `HeuristicRanker` over `CandidateFeatures` only.
- [x] Produce typed breakdown/reason contributions.
- [x] Demonstrate context-dependent deterministic ranking and cold start with deterministic tests.
- [x] Keep the AI caller unchanged until the V2 response contract and ranking tests pass.

### Phase 6 — Semantic retrieval

- [x] Introduce Qdrant only as an opt-in Compose profile, disabled by default.
- [x] Add `EmbeddingClient`, `VectorSearchClient`, content builder/hash/version metadata and caching.
- [x] Implement semantic retrieval as a `CandidateGenerator` participating in RRF.
- [x] Fall back cleanly when embedding/vector systems are unavailable.
- [x] Never alter `Place.java` with embedding or user-specific scores.

### Phase 7 — Impressions, feedback and profiles

- [x] Approve retention/privacy/volume design and add recommendation PostgreSQL/Flyway.
- [x] Persist immutable impressions/items before acknowledging tracked results.
- [x] Implement idempotent validated event ingestion and outbox.
- [x] Implement configured event weights and temporal decay.
- [x] Add long-term/trip/session profile ports and cold-start fallback.
- [x] Resolve Context vs legacy User preference compatibility explicitly.

### Phase 8 — MMR

- [x] Implement similarity port, category fallback and MMR.
- [x] Add category coverage and near-duplicate tests.

### Phase 9 — Learning-to-Rank readiness

- [x] Persist versioned features, groups, impressions, positions and labels in exportable typed structures.
- [x] Define artifact validation and fallback boundary for `LightGbmRanker`.
- [x] Keep LightGBM inactive until a real evaluated artifact and rollout plan exist.

### Phase 10 — Offline evaluation and controlled migration

- [x] Implement Recall@K, NDCG@K, MRR, Precision@K, intra-list diversity and category coverage utilities.
- [ ] Operational follow-up: compare heuristic/V2 against production versioned labels when enough real impression/feedback data exists; do not fabricate this result.
- [x] Route `ai-service` through V2 and remove its duplicated deterministic final-ranking formulas.
- [ ] Operational follow-up: perform staged deployment observation before enabling optional semantic retrieval or a future learned ranker.

### Required tests by phase

| Test | Phase |
| --- | --- |
| Interface/orchestration/boot/config validation | 1 |
| Place adapter contract, empty/partial/unavailable, cold start | 2 |
| RRF exact values, duplicate IDs, one/zero sources, generator failure | 3 |
| Bayesian rating, log popularity, Haversine, exponential decay, hard filters, null/missing inputs | 4 |
| Heuristic rank ordering, tie stability, feature availability, different contexts | 5 |
| Mock embedding/vector clients, content hash/cache, semantic fallback | 6 |
| Temporal decay, idempotency, ownership, position validation, profile fallback | 7 |
| MMR one/empty/fewer-than-limit, category and embedding similarity | 8 |
| Model/feature incompatibility and heuristic fallback | 9 |
| Metric golden cases and zero-relevance edge cases | 10 |

### Verification commands

```bash
./mvnw spotless:check
./mvnw test
./mvnw -pl services/recommendation-service -am test
```

For phases that change Compose:

```bash
docker compose config
docker compose -f deploy/docker-compose.prod.yml config
```

No test may require real ZioMap, embedding, vector or LLM APIs; use mocks/stubs/contract fixtures. Integration tests for persistence should use isolated test infrastructure appropriate to the approved phase.

---

## 10. Implementation Review Gates

Before each phase starts, verify:

1. The previous phase is merged/reviewed and the repository is green.
2. No interface is redesigned without a concrete defect documented here.
3. No new infrastructure is introduced earlier than its owning phase.
4. Existing Place APIs and `PlaceRankingService` remain compatible.
5. New formulas have one authoritative implementation and focused tests.
6. Application orchestration remains thin and no class accumulates retrieval, formulas, persistence and transport.

The user approved implementation through all phases on 2026-09-24. Each phase must still be verified before the next phase changes its dependent contracts or infrastructure.

### Implementation review results

- **Architecture — PASS**: `place-service` remains the retrieval/candidate owner; its `PlaceRankingService` and `recommend(...)` contracts remain compatible. `recommendation-service` owns context resolution, fusion, hard filtering, features, personalization, final ranking, diversity, impressions and feedback. ArchUnit rules enforce that domain/application code cannot depend on transport or adapter packages.
- **Database — PASS**: recommendation data is owned by a dedicated PostgreSQL schema managed with Flyway. No cross-service foreign keys, JPA relationships or direct database reads were introduced. Feedback writes, idempotency and outbox insertion are local and transactional.
- **Security — PASS**: JWT identity is authoritative, downstream authorization is forwarded, inaccessible trips return a privacy-safe 404, feedback validates recommendation ownership/place/position, idempotency conflicts return 409, gateway rate limiting is enabled and personalization erasure deletes recommendation-owned user data.
- **API compatibility — PASS**: no existing Place endpoint was renamed. The AI layer now consumes V2 results and only verbalizes typed ranking evidence; it no longer recalculates final ordering.
- **PR review — PASS**: no blocker, high or medium finding remains after review. Configuration owns weights, versions, limits, TTLs and timeouts; scoring formulas have one authoritative implementation.

Known low-risk operational follow-ups:

1. Semantic search is disabled by default. Qdrant activation requires a capacity-reviewed deployment profile, an embedding provider and a Place-owned change/event feed for index population.
2. The current semantic hydrator calls the existing Place details contract per vector result. Add a Place-owned batch-read API before high-volume semantic rollout to remove this N+1 pattern without crossing database boundaries.
3. Recommendation currently consumes consented Context signals under the existing `TRIP_PLANNING` purpose for compatibility. A distinct recommendation purpose requires a separately approved consent-contract migration.
4. A real LightGBM/LambdaMART artifact and production offline comparison are intentionally absent; the stable heuristic ranker remains the supported fallback.

### Final verification

- Recommendation service: 31 tests passed, including algorithm edge cases, graceful degradation, feedback validation and architecture dependency rules.
- API Gateway: 9 tests passed.
- Place service: 25 tests passed.
- AI service: 77 tests passed; one upstream Starlette/AnyIO deprecation warning remains.
- Social/context regression subset: 57 tests passed.
- Full ten-module Maven reactor: package/compile succeeded.
- Full Maven test invocation reached `trip-service`; three pre-existing Testcontainers-based tests could not start because the safe build container had no Docker socket. Docker socket mounting was not granted. This is an environment limitation, not a compile or V2 test failure.
- Development and production Compose configurations validate successfully.

---

## Human Approval Gate

```text
STATUS: DONE
```

Approved by the user on 2026-09-24 and completed through the production-ready heuristic baseline. Optional semantic activation, learned-model activation and data-backed production evaluation remain gated follow-ups rather than fabricated completion claims.
