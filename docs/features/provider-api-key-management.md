# Provider API Key Management — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/place-service`
- **Affected Components**: `apps/web/tripsense`, `services/place-service`, `services/api-gateway`
- **Created Date**: 2026-09-29
- **Target Boundaries**:
  - Phase 1: Database Model & Repository Refactor (Partial Unique Index, Enum expansion, Transient query removal)
  - Phase 2: Atomic Key Switcher, In-Memory Caching with Instant Invalidation, Thundering Herd Protection & Auto-Rotate with Retry
  - Phase 3: REST API Endpoints & Internal Resolution Endpoint
  - Phase 4: Frontend UI Enhancement (`TokenPoolCard`, States, Actions & i18n)
  - Phase 5: Comprehensive Unit & Integration Tests

---

## 1. Goal & Requirements

### 1.1 Problem Statement
The application relies on third-party provider APIs (ZioMap, Gemini, MapVina, OpenAI, etc.). Providers can exceed quota (429), encounter rate limits, expire, or get revoked (401/403). Previously:
- Multiple keys could inadvertently become `ACTIVE` concurrently due to lack of DB constraints and non-atomic operations.
- Rotations caused a "thundering herd" where multiple concurrent failing requests rotated through all standby keys in seconds.
- Place requests hitting quota rotated the key but immediately failed with 503 rather than retrying with the newly rotated key.
- Querying `@Transient rawKey` in `ApiKeyPoolRepository` caused runtime issues.
- Admins could not explicitly disable a key without deleting it.
- Database lookups and AES-GCM decryption occurred repeatedly on every single request without in-memory caching.

### 1.2 Target Flow
`Provider -> API Key Pool -> Active Key -> Provider Client`
- Each provider can have multiple API keys.
- Exactly ONE key is `ACTIVE` per provider at any given time, enforced at the database level.
- When an admin activates Key C:
  `Current ACTIVE Key B -> INACTIVE`
  `Target Key C -> ACTIVE`
  All new requests to that provider immediately use Key C via instant in-memory cache invalidation.
- Keys can be `ACTIVE`, `INACTIVE` (standby), `DISABLED` (manually turned off by admin), `EXHAUSTED` (temporarily quota-limited), or `INVALID` (permanently rejected by provider).

---

## 2. Architecture & Data Contracts

### 2.1 Database Model (`api_key_pool`)
Document: `fu.tripsense.placeservice.domain.model.ApiKeyPoolItem`
- Compound Index 1: `{'provider': 1, 'keyHash': 1}` (unique = true) — prevents duplicate keys.
- Compound Index 2: `{'provider': 1, 'status': 1}` (unique = true, partialFilter = `{'status': 'ACTIVE'}`) — guarantees at most ONE `ACTIVE` key per provider at the database engine level.

### 2.2 Status Lifecycle
- `ACTIVE`: Key currently in active use.
- `INACTIVE`: Standby key, healthy, eligible for manual activation or auto-rotation.
- `DISABLED`: Manually disabled by admin. Never auto-promoted or revived by quota reset.
- `EXHAUSTED`: Temporarily quota-limited (HTTP 429). Can be reset manually or after cooling down.
- `INVALID`: Permanently rejected (HTTP 401/403). Never auto-promoted.

### 2.3 Provider Enum
`ZIOMAP`, `GEMINI`, `MAPVINA`, `OPENAI`, `GOOGLE_MAPS`.

---

## 3. Implementation Steps

1. **Database & Model Layer**:
   - Update `ApiKeyStatus` with `INACTIVE`, `DISABLED`.
   - Update `ApiKeyProvider` with extended providers.
   - Add partial unique index on `ApiKeyPoolItem`.
   - Clean up `ApiKeyPoolRepository` (remove transient `rawKey` query, add `findByProviderAndStatus`).

2. **Core Service Layer (`ApiKeyPoolService`)**:
   - Atomic `setActiveKey(id)` using `MongoTemplate` or bulk operations.
   - In-memory `ConcurrentHashMap` cache for active decrypted keys with immediate invalidation on state change.
   - Thundering herd protection in `markExhaustedAndRotate`: only rotate if failed key is still the currently active key.
   - Add `disableKey(id)` and `enableKey(id)` methods.
   - Disallow `resetQuotaAll` from modifying `DISABLED` or `INVALID` keys.

3. **Client Runner & Retry (`ZioMapProvider`)**:
   - Auto-rotate and retry the failed request 1 time with the newly activated key on quota/429 errors.
   - Always resolve active key dynamically from `ApiKeyPoolService`.

4. **REST Endpoints**:
   - `POST /api/places/admin/keys/{id}/activate`
   - `POST /api/places/admin/keys/{id}/disable`
   - `POST /api/places/admin/keys/{id}/enable`
   - `POST /api/places/admin/keys/{id}/test`
   - `GET /api/places/admin/keys?provider=...`
   - `GET /api/places/internal/keys/active?provider=...`

5. **Frontend UI**:
   - Update `token-pool-card.tsx` to handle `INACTIVE` and `DISABLED` statuses.
   - Add toggle disable/enable action and confirmation dialog for activation.
   - Update TypeScript types and translation strings.

6. **Testing**:
   - Unit tests for atomic activation, thundering herd protection, disabled key exclusion, and quota resets.
   - Frontend tests for API integration.
