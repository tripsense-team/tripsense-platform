# Partner Autocomplete Text Search Fallback — Specification & Implementation Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

- **Owner Service**: `services/place-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`
- **Date**: 2026-10-18
- **Related Feature**: [Partner Location Autocomplete](./partner-location-autocomplete.md)
- **Evidence**: Partner wizard calls `/api/places/autocomplete` successfully but receives `{success:true,data:[]}` for “Quán Chay Tịnh Quán”, while the same POI is visible in Explore. Explore search and Partner autocomplete use separate retrieval paths.

## 1. Goal & Requirements

### 1.1 Goal

Show discoverable Place records in the HOTEL/RESTAURANT Partner location picker when provider autocomplete returns no suggestions. Keep the existing autocomplete as the preferred path and resolve any chosen suggestion through the existing Place details endpoint before submitting the canonical Place ID and location snapshot.

### 1.2 User Flow

1. Partner enters at least two characters in the location field.
2. Web calls `GET /api/places/autocomplete` through the API Gateway.
3. Place Service first uses its existing autocomplete provider and local lookup behavior.
4. If that result is empty, Place Service performs bounded provider text search with the same query and effective location/radius, then maps valid Place results to autocomplete suggestions.
5. Web displays suggestions. Selecting one still calls `GET /api/places/{id}`; only a successful, complete details response becomes the selected canonical Place.
6. If both lookup paths return no usable results, show the existing empty state and retain manual name/address entry.

### 1.3 Scope

**In scope**

- Add Place Service fallback from empty autocomplete results to the existing `PlaceProvider.textSearch` operation.
- Reuse the current `GET /api/places/autocomplete` contract and existing details resolution flow.
- Map provider Place IDs, names, addresses, and categories into the existing suggestion DTO; deduplicate and cap results at the requested limit (maximum 10).
- Add focused service tests and Partner wizard regression coverage for selecting a fallback suggestion and resolving canonical details.

**Out of scope**

- Calling recommendation-service or AI for location search.
- New browser-to-provider calls, new credentials, Gateway routes, API endpoints, database tables, or migrations.
- Changing Explore search/recommendation ranking, default geographic bias, Partner ownership verification, or manual-entry policy.
- Changing hotel/restaurant application approval rules.

### 1.4 Acceptance Criteria

- [ ] AC-1: Existing autocomplete results remain preferred and do not trigger text search.
- [ ] AC-2: When autocomplete and local fallback produce no usable suggestions, a bounded provider text search is attempted.
- [ ] AC-3: Fallback results use provider Place IDs accepted by the existing details endpoint; no fabricated ID or name-only selection is allowed.
- [ ] AC-4: Duplicate IDs, blank IDs/names, and results beyond the requested maximum are excluded.
- [ ] AC-5: If fallback also returns no results, the endpoint returns the normal successful empty response; upstream failure follows existing sanitized API error behavior and never exposes provider payloads or secrets.
- [ ] AC-6: Out-of-order browser searches and selection/detail races remain guarded; a failed details lookup cannot mark a suggestion selected.

## 2. Architecture & Service Boundaries

### 2.1 Flow

```text
Partner wizard
  -> API Gateway: GET /api/places/autocomplete
  -> Place Service: autocomplete provider + local lookup
       -> if empty: existing PlaceProvider.textSearch(query, location, radius, limit)
  <- bounded AutocompleteSuggestionDto list
  -> API Gateway: GET /api/places/{providerPlaceId}
  -> Place Service: provider details + canonical Place persistence/DTO
```

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `apps/web/tripsense` | Debounced lookup, empty/error states, selecting a suggestion and resolving its details. No provider calls. |
| `services/api-gateway` | Existing public Place route and configured rate limits; no business logic change expected. |
| `services/place-service` | Owns provider integrations, Place persistence/cache, autocomplete and text-search fallback. |
| `services/trip-service` | Continues receiving canonical Place ID/address/coordinates in the Partner application snapshot; never reads Place storage directly. |

All communication remains synchronous because the Partner needs a result while the user is choosing a location. No Kafka event or new service is needed.

## 3. API & Contracts

No externally visible contract change.

| Method | Path | Auth | Use |
| --- | --- | --- | --- |
| `GET` | `/api/places/autocomplete?q={query}&limit=10` | Existing public Place policy | Returns preferred autocomplete suggestions or bounded text-search fallback suggestions. |
| `GET` | `/api/places/{id}` | Existing public Place policy | Resolves selected provider ID to Place details; required before selection/submission. |

Response remains `{success:true,data:[{id,title,subtitle?,category?}],meta:{...}}`. Search fallback must populate `id` from `providerPlaceId` when available, otherwise from an already canonical Place ID that the details endpoint can resolve. Do not return raw provider responses.

Input validation, query length, limit (1–10), location/radius defaults, and existing HTTP error handling remain unchanged.

## 4. Data Model & Migrations

- **Owning service**: `place-service` owns Place records and provider cache.
- **Schema changes**: None.
- **Migrations/indexes**: None.
- Existing text-search results may be upserted through the existing Place persistence adapter if needed to make the returned ID resolvable and to reuse canonical data. This write remains inside Place Service and follows its current deduplication/provider ID rules.
- Trip Service receives only the resolved Place ID and snapshot fields through its existing Partner application contract; no cross-service database access or JPA relationship is introduced.

## 5. Security & Trust Boundaries

- Browser continues to call only the API Gateway; provider credentials stay in Place Service environment/configuration.
- Validate and bound query, limit, radius, and provider result count using existing Place rules.
- Treat provider suggestions as unverified location candidates, not proof of Partner ownership. Existing business-document review and ownership checks remain authoritative.
- Resolve selected IDs through Place details. Never synthesize a successful details response from suggestion text or accept a client-provided arbitrary URL/coordinates as provider proof.
- Return only existing public suggestion fields; do not expose provider payloads, API keys, exception messages, or internal traces.
- Preserve Gateway rate limiting and existing Place provider retry/key rotation policies.

## 6. Trade-offs & Failure Handling

| Concern | Decision |
| --- | --- |
| Provider calls/cost | Keep autocomplete first. Invoke text search only for empty results, with existing debounce, maximum 10 results, backend provider controls, and Gateway rate limit. |
| Duplicates | Preserve autocomplete order; append only unseen valid fallback IDs and stop at the requested limit. In the initial empty-result case, the fallback list is naturally the whole response. |
| Provider outage | Preserve existing local results when available. If both provider operations fail and local lookup is empty, use existing sanitized failure behavior; do not return a fabricated match. |
| Data consistency | Place Service remains the sole owner. Persist fallback provider records through its current adapter if required for canonical details resolution. |
| Rejected alternative | Calling recommendation-service from the Partner form was rejected: location identity lookup is Place Service ownership, not personalized ranking. |

## 7. Implementation Tasks & Verification

Implementation starts only after this plan is approved.

1. Update `PlaceSearchServiceImpl.autocomplete` to keep current preferred lookup, then call bounded provider text search only if no valid local/provider autocomplete suggestions remain.
2. Convert results to `AutocompleteSuggestionDto`, use resolvable canonical/provider IDs, deduplicate, cap at limit, and persist via existing Place adapter only where required by the details contract.
3. Add Place Service tests for preferred-path short-circuit, empty-result fallback, provider failure, local result behavior, deduplication, maximum limit, and detail resolvability.
4. Add/adjust Partner wizard tests proving a fallback suggestion is displayed, resolved by details ID, and submitted only with canonical ID/address/coordinates; preserve abort/race behavior.
5. Verify Place Service and web checks, inspect Gateway contract/rate limiting, and manually reproduce the reported query in the wizard without submitting a real Partner application.

Suggested verification:

```bash
./mvnw -pl services/place-service test
cd apps/web/tripsense && npm test -- src/features/partner src/features/places
cd apps/web/tripsense && npm run type-check && npm run i18n:check
```

## Human Approval Gate

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

Approve this scope before application code changes.
