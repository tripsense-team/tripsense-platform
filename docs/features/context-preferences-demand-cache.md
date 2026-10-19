# Context Preferences Demand Cache — Specification & Implementation Plan

`STATUS: DONE`

Human approved implementation on 2026-10-19: “Tiến hành implements.” Code, reviews and automated verification completed; local/production activation remains an explicit deployment step.

- Created: 2026-10-19.
- Owner/application: `services/context-service`.
- Affected infrastructure: dedicated disposable Context Redis cache and `deploy/docker-compose.prod.yml`; local configuration instructions.
- Related: [Context-owned personalization](./context-owned-personalization.md) (DONE). That feature explicitly excluded this new cache; this plan authorizes no code until approved.

## 1. Goal, evidence and scope

Cache compact purpose-filtered onboarding preference responses on demand, not every registered account. Keep Context DB authoritative and keep existing Recommendation/AI HTTP contracts unchanged. No localStorage, browser prefetch, consumer-owned Context copies, User consent dependency, ranking changes, Kafka work or full onboarding cache.

Verified current source:

- `/api/context/preferences` reads user signals then calls dimension catalog lookups while filtering by purpose. No Redis dependency/config exists in Context.
- `OnboardingService.save/complete/delete` owns local DB transactions. Completed saves/complete regenerate signals. Draft saves do not publish preferences; delete removes onboarding signals.
- `OnboardingProfileEntity` has immutable UUID id, `@Version long version`, status and schemaVersion. `user_id` is unique/indexed. Do not use a domain version before JPA flush as a committed cache revision.
- Existing outbox writes do not prove reliable distributed cache invalidation; deletion has no outbox event. Do not build correctness on unverified Kafka delivery.
- Recommendation/AI already consume purpose-filtered signals; no consumer changes should be necessary.

Acceptance objectives: lazy population, bounded storage and fallback concurrency, no cross-user leakage, current committed preferences after settings save/delete, graceful cache failures, no DB migration, deterministic race tests.

## 2. Architecture decision: version-addressed response cache

```text
Authenticated request -> Context
  -> small DB metadata snapshot: profile identity/version/status + dimension catalog
  -> Redis lookup: user + committed revision + purpose + catalog fingerprint
       hit  -> validated compact projection
       miss -> same DB snapshot reads signals -> deterministic purpose filter
            -> best-effort cache PUT with TTL -> unchanged HTTP response
```

### Consistency vs a completely DB-free cache hit

Choose correctness without adding an outbox consumer: **a hit still performs lightweight DB metadata reads**, but skips full signal loading and repeated per-signal catalog queries. Use scalar projections for metadata; never load the full onboarding entity/relations/freeText for a version check. Read active catalog definitions in one bounded query, not N+1 queries.

Use an application service with a Spring read-only PostgreSQL REPEATABLE_READ transaction so profile revision, catalog and signals on a miss are from one snapshot. A cached response must have been computed under that exact revision/catalog/purpose. Release the transaction before network cache PUT where practical; carry immutable snapshot metadata/result out of the transaction. Redis GET has a small timeout; do not hold DB connections while waiting for locks.

A request starting after a save commit observes a different version and never looks up the old key. An older in-flight read may still complete with its prior snapshot; it can only fill the old version key. No linearizability guarantee for requests overlapping writes is claimed. Delete produces no profile => return `[]`, never use old cache; delete/recreate has a new profile UUID even if version resets.

This intentionally trades a small DB check for eliminating stale-cache recovery problems. It is NOT advertised as eliminating all DB requests or guaranteeing lower latency. A future DB-free read design needs reliable revision/event propagation and a separately approved consistency trade-off.

### Write lifecycle

- No cache writes inside onboarding mutation transactions. Preserve current save/complete/delete and optimistic locking.
- New committed revision makes old keys unreachable; TTL/eviction reclaims them. No Redis key scan or synchronously required delete needed for correctness.
- Rollback does not change the committed revision, so no invalidation of valid cache is required.
- Catalog changes (active/sensitivity/schema/cardinality/code) change deterministic catalog fingerprint. Sensitive reclassification must not keep serving an older STANDARD projection.
- No cached legacy-profile fallback when metadata DB is unavailable: fail through existing safe API errors; consumers already have neutral/history fallback. Do not serve data whose current revision/owner cannot be established.

## 3. Contracts, payload and cache keys

Public endpoints/auth/response shapes unchanged:

| Endpoint | Contract |
| --- | --- |
| GET `/api/context/preferences?purpose=EXPLORE_RECOMMENDATION` | Bearer owner, raw PreferenceResponse array; STANDARD plus allowed Explore affinity |
| GET `/api/context/preferences?purpose=TRIP_PLANNING` | Bearer owner, raw PreferenceResponse array; STANDARD only |
| GET/PUT/DELETE `/api/context/onboarding`, start/complete | Unchanged; onboarding settings read directly from DB, not this cache |

Unsupported purpose remains 400 before any cache/DB lookup. Authentication precedes all cache access. No client-supplied owner override.

Internal key example:

```text
ctx:prefs:v1:{HMAC_SHA256(cache-secret, userId)}:schema1:<profileUuid>:<version>:<status>:<purpose>:<catalogHash>
```

All variable components are server-derived and bounded. No bearer tokens, raw freeText, preference values or raw user IDs in keys/logs. Secret backend-side only; disabled caching if enabled config has no valid cache secret, with a sanitized configuration warning.

Internal payload contains schemaVersion, exact revision/purpose/catalog identifiers and a sorted immutable signals array (`dimensionCode,valueCode,confidence,source,updatedAt`). Validate metadata before use. No raw onboarding attributes, booking/flight data, sensitive dimensions or freeText. Preserve existing filtering behavior; raw array remains unchanged at HTTP boundary.

- Max cache payload: 64 KiB, max signals: 200, matching existing consumers' defensive limits. Oversize/unsupported projections are not cached or silently truncated; preserve existing uncached endpoint behavior.
- Corrupt/mismatched/unknown-schema cache entry => miss, best-effort delete exact key, load from DB. No polymorphic/JDK native deserialization.
- Completed empty response may be cached for its revision. Missing/draft profile returns `[]` without populating long-lived negative records; never allocate cache records for all accounts.
- No new Kafka topics/events, no public API or DB schema migration.

## 4. Scale, TTL, memory and stampede controls

### Demand and retention

- Default payload TTL: 10 minutes with random ±20% jitter (8–12 minutes), fixed on PUT, not refreshed on every read.
- Only an authenticated preference request can populate its projection. At most two current-purpose entries per current user revision; older revision keys may coexist until TTL/eviction. Do not claim a strict two-key-per-account bound.
- Estimate payload memory from distinct cached user-revision-purpose combinations in the TTL window, not concurrent online count or total registered accounts. Redis/key metadata/replica costs are additional.

### Dedicated capacity

Use a dedicated **disposable Redis cache instance**, not a global policy change to shared Redis that might contain sessions/locks. Add a `context-cache` infrastructure container (not a new business microservice) in prod Compose:

- Redis image pinned to a supported explicit version at implementation time (verify before choosing; no invented/latest tag).
- Example initial container RAM budget 192 MiB, Redis `maxmemory 128mb`, `maxmemory-policy allkeys-lfu`; these are development/small deployment defaults, NOT a million-user capacity claim.
- No public port or persistent volume in production; private service network only, healthcheck, pinned image, persistence disabled. Keep headroom for process/client buffers and validate actual container behavior.
- `CONTEXT_CACHE_REDIS_URL` points Context only to this instance; do not repoint existing `REDIS_URL` for other services. Managed Redis may replace it via config, with operator-confirmed equivalent memory/eviction isolation.
- Local setup uses a dedicated local cache endpoint (e.g. localhost:6381); do not silently change an existing local Redis server's global CONFIG. Default code cache flag false until endpoint/secret are configured. Prod Compose may enable after supplying its dedicated endpoint/secret. No automatic live provisioning/restart in this implementation task.

Eviction/OOM/restart is a cache miss/failure, never lost user data. Do not promise per-namespace memory isolation by merely selecting another Redis DB number.

### Concurrency and outage behavior

- Bound Redis connect/command timeouts (initial 100ms command, 200ms connect); no synchronous retry storm. Short circuit-breaker/backoff after repeated Redis failures, then occasional probes; DB-only fallback should not pay failed Redis round trips every request.
- Per-instance single-flight keyed by revision+purpose; bounded registry and follower wait. Same key shares one load, not an unbounded lock/future per historical user. Cleanup on success/error/cancellation.
- A fixed global/per-instance DB projection-load semaphore bounds concurrent misses (initial 16, configurable) with short acquisition deadline. When saturated, return sanitized 503 through existing safe error handling rather than enqueue indefinitely or overload DB. Also bound concurrent metadata requests through existing server/DB pools and an explicit request admission cap in the cache facade.
- Multiple Context replicas can each load a hot miss once. This is an explicit bounded duplication trade-off; do not claim cluster-wide single-flight. No Redis distributed lease is needed for correctness (eviction of locks would complicate it).
- No blocking waits inside an open DB transaction for single-flight/admission. Leader loads its own snapshot; followers must only reuse the exact revision/purpose/catalog result they requested. If metadata changed before leader snapshot, re-resolve boundedly rather than returning/writing under the wrong key.
- Do not keep caches permanently alive, prewarm all users, scan accounts, or build unbounded in-memory per-user locks.

## 5. Implementation boundaries and operational configuration

Add Context Redis dependency, properties and configured adapter; use the project's supported JSON mapping and StringRedisTemplate conventions with explicit payload validation. Keep cache orchestration separate from controller and JPA projection loader. Introduce ports for snapshot metadata/projection loading and cache access rather than exposing JPA entities to HTTP consumers.

Planned settings:

```text
CONTEXT_PREFERENCES_CACHE_ENABLED=false
CONTEXT_CACHE_REDIS_URL=redis://localhost:6381
CONTEXT_CACHE_KEY_SECRET=<backend secret, never checked in>
CONTEXT_PREFERENCES_CACHE_TTL=10m
CONTEXT_CACHE_COMMAND_TIMEOUT=100ms
CONTEXT_CACHE_CONNECT_TIMEOUT=200ms
CONTEXT_CACHE_MAX_LOADS=16
```

Exact admission/follower/circuit limits get validated bounds and documented defaults during implementation. No changes to external recommendation/AI endpoints or their identity logic.

Minimal low-cardinality cache metrics (hit/miss/error/bypass/rejected/load), no user labels or profile content; no dashboard project. Metrics must be available via existing Micrometer conventions or the minimal actuator/registry dependency required in Context. This is verification support, not a request for repeated user monitoring.

Database ownership stays Context-only, scalar lookup uses existing unique user index, catalog is small, and signals retain the user/dimension index. No destructive migrations or cross-service SQL. Rollback: disable feature flag/redeploy previous Context; old cache namespace expires naturally. Do not flush shared Redis or erase onboarding data.

## 6. Tasks and acceptance tests

### Phase A: Snapshot/projection foundation

- [x] Add scalar committed revision lookup and one-shot active catalog projection; verify query counts avoid eager relations/N+1.
- [x] Build read-only repeatable-read snapshot loader with immutable results, preserving existing purpose/security filtering and response shape.
- [x] Keep draft/empty/delete/recreate and optimistic-lock rollback behavior correct.

### Phase B: Bounded on-demand cache

- [x] Add Redis adapter/config, strict bounded payload validation, HMAC/versioned keys and TTL jitter.
- [x] Add bounded single-flight/admission and Redis failure backoff, no user-scaled in-memory map.
- [x] Dedicated Redis Compose configuration and documented local setup; no global shared Redis mutation.

### Phase C: Verification and handoff

- [x] Hit/miss contract: same owner/revision/purpose uses payload cache; no eager user population, no full profile/freeText caching.
- [x] Multi-user/purpose isolation; auth missing => no cache access; invalid purpose => no cache access; corrupt/oversize JSON safe fallback.
- [x] Deterministic races with barriers: old read/save/new read; failed save/rollback; delete + recreate same user; catalog reclassification; concurrent two-replica fills. Assert old data never fills the current revision key.
- [x] Single-flight concurrency/cancellation/timeout/map cleanup; semaphore saturation returns bounded safe failure; Redis outage circuit/probes do not multiply DB loads without bound.
- [x] TTL range, no sliding expiry, LFU/OOM eviction and restart behavior in a dedicated disposable Redis integration environment; do not use live user Redis as a test fixture.
- [x] PostgreSQL transaction integration test proves committed scalar `@Version` and consistent snapshot revision/signals; mocks alone are insufficient for race/isolation claims. If disposable infra is unavailable, record the exact blocked CI test, not an assumed pass.
- [x] Existing Context tests plus Recommendation offline and AI contract suites remain green. No cloud Qdrant mutation or real LLM invocation.
- [x] Compose model validation, code formatting, diff check; document no guaranteed latency gain/million-user certification without deployment evidence.

Verification commands planned from root:

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/context-service -am test -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
npm --prefix services/ai-service test
docker compose -f deploy/docker-compose.prod.yml config --no-interpolate --quiet
git diff --check
```

Disposable Redis/PostgreSQL integration harness and verified command are documented in Completion below. The ordinary test command skips these six opt-in integration cases; do not mistake that for an integration pass.

## 7. Synthesis, alternatives and approval

- Product: cache active use only, keep stored profile authoritative, preserve current UX/API.
- Architecture/API: Context-only ownership; consumers need no storage coupling; no new business service or Kafka pipeline.
- Persistence: existing DB revisions and transactional reads avoid schema changes; correctness does not rely on cache invalidation succeeding during Redis outage.
- Security: authenticate before cache, purpose/catalog freshness, no full/raw sensitive profile payload, isolated eviction domain.
- Trade-off: version-addressed payload cache intentionally retains DB metadata reads and old-version keys until expiry. This is safer than claiming TTL or after-commit DEL alone prevents stale fills.
- Rejected: whole-profile localStorage; preload all users; per-process unbounded user maps; global LFU config on shared Redis; unreliable DEL-only invalidation; claiming production-million-user readiness from unit tests.

Approval requested for this concrete scope, particularly dedicated bounded Redis infrastructure and the lightweight DB revision checks on cache hits. After approval, implement A–C; do not start application code before the gate.

`STATUS: DONE`

## 8. Completion and review — 2026-10-19

### Delivered implementation

- `CachedPreferencesService`: owner/purpose orchestration, 64 admitted requests, at most 16 projection loads, 25ms admission wait, 750ms follower wait, bounded single-flight registry and one revision re-resolution. Interrupted followers preserve interrupt status without cancelling the shared load. Busy requests return sanitized 503 + Retry-After: 1.
- `JdbcPreferenceSnapshotSource`: Context-only scalar SQL in read-only REQUIRES_NEW/REPEATABLE_READ transactions; two metadata SELECTs for completed profiles, three SELECTs on full load, no eager profile relations or N+1 catalog queries. Query timeout 2s, transaction timeout 3s; Context Hikari acquisition capped at 1000ms (overridable with CONTEXT_DB_CONNECTION_TIMEOUT).
- `RedisPreferenceSnapshotCache`: HMAC of all owner/revision/purpose/catalog material under `ctx:prefs:v1:`. Typed JSON envelope, 200-signal/64KiB bound, fixed 8–12 minute jitter, corrupt/wrong-type/oversize cache miss. Bounded Lua checks size/type before returning payload, so oversized cache values are not downloaded first. No raw onboarding profile/freeText.
- Circuit opens after three Redis operation failures for 5s, permits a later probe, resets broken shared Lettuce connections to permit reconnect without synchronous retries. Disabled/missing/blank/short secret bypasses cache; no generated toString includes secret/Redis credentials. Connection/command deadlines 200ms/100ms.
- Existing onboarding mutations/transactions/schema and User/AI/Recommendation contracts remain unchanged. Keys for prior revisions expire/evict; no mutation-time Redis dependency or scan/delete invalidation required.
- Dedicated Compose `context-cache`: `redis:8.2.10-alpine`, 128mb Redis maxmemory/allkeys-lfu inside a 192m container, persistence off, `/data` tmpfs, no host port, only a private internal network shared with Context. Tag verified against [Docker Official Redis image supported tags](https://hub.docker.com/_/redis). No container was deployed/pulled during this task.
- Feature defaults off in application config, prod Compose requests enablement but still requires a >=32-character secret; missing secret logs a fixed warning and remains DB-only. No live env files were changed.

### Actual verification results

| Check | Result |
| --- | --- |
| Context complete suite with integration opt-in | 43 passed, 0 failed, 0 skipped |
| Of those: real Redis integration | 1 passed: roundtrip, TTL expiry, wrong type/oversize, LFU eviction, OOM, restart/reconnect |
| Of those: PostgreSQL + JPA integration | 5 passed: committed @Version, query counts, rollback, delete/recreate, repeatable-read race, catalog filtering/draft lifecycle |
| Recommendation offline regression, cloud mutation excluded | 162 passed, 0 failed |
| AI npm test including tsc | 19 passed, 0 failed |
| Scoped Java Spotless | Passed |
| Compose config --no-interpolate --quiet | Passed (model validation, not deployment) |
| git diff --check | Passed |

Integration tests used new temporary localhost processes and data directories, Redis 8.2.1 and PostgreSQL 18.4 installed on this machine; production image patch/container limits have not been load-tested. Docker daemon was unavailable, so the integration harness uses local binaries instead. Initial sandbox networking denial was resolved by an approved test-command escalation; no live DB/Redis credentials were used. Fixtures stop their temporary processes and remove their own directories. No million-user benchmark or production latency claim is made.

Verified combined command (from root):

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/context-service,services/recommendation-service -am test -Dcontext.cache.integration=true '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```

Integration harness requires permission to bind localhost ports. Defaults: `/opt/homebrew/bin/redis-server` and `/opt/homebrew/opt/postgresql@18/bin`; CI/Linux can override `-Dcontext.test.redis.bin=/usr/bin/redis-server -Dcontext.test.pg.bin=/usr/lib/postgresql/18/bin`. Tests create their own clusters, not an existing service URL. They fail explicitly if opt-in prerequisites are missing.

### Required self-review

- Architecture: cache belongs only to Context; consumers keep existing APIs; no browser storage/shared DB/entity coupling. No blocking findings.
- Database: no migrations; real integration verifies authoritative JPA revision, repeatable read, rollback and indexed scalar queries. No blocking findings.
- Security: auth before cache, no caller-controlled owner, current catalog fingerprint, payload bounds, secret-safe property/error handling and isolated Redis network. Existing purpose filtering retained. No blocking findings; this is not a full production penetration test.
- PR: source/cache/facade responsibilities separated, bounded waits and registries, opt-in integration prerequisites documented, regression suites green. No blocking findings. Existing unrelated working-tree changes preserved.

## 9. Local activation with scripts/start.sh

Code is complete, but **the local cache is not enabled automatically**. DB remains authoritative and existing behavior works until configured. Do not point this feature at the shared Redis (:6379) simply to avoid starting the dedicated cache.

### 1. Start a dedicated local Redis in a separate terminal

Homebrew Redis is already available on this machine. This creates an empty temporary working directory so it cannot load another Redis instance's dump:

```bash
CONTEXT_CACHE_DIR="$(mktemp -d /tmp/tripsense-context-cache.XXXXXX)"
redis-server --bind 127.0.0.1 --port 6381 --dir "$CONTEXT_CACHE_DIR" --save "" --appendonly no --maxmemory 128mb --maxmemory-policy allkeys-lfu
```

Leave that terminal running. If port 6381 is occupied, check what owns it; do not kill unknown processes. Choose another dedicated port and change the URL below if needed. Stopping this Redis loses cache only, not onboarding data.

### 2. Add cache settings to your local env/.env (never commit the secret)

Generate a fresh secret locally with `openssl rand -hex 32`, then use its output as the value, not the placeholder:

```dotenv
CONTEXT_PREFERENCES_CACHE_ENABLED=true
CONTEXT_CACHE_REDIS_URL=redis://localhost:6381
CONTEXT_CACHE_KEY_SECRET=<paste-the-generated-secret-here>
```

TTL remains 10m with jitter; no other env changes are needed. Missing/short secret deliberately leaves cache disabled. Keep this secret stable across replicas; rotating it causes a harmless cold namespace.

### 3. Restart only Context Service (:8087)

Stop its current Terminal process with Ctrl+C, then run from repo root:

```bash
bash scripts/start.sh
```

The script skips already-running services. Recommendation, AI, User and Gateway do not need restarts for this cache-only feature.

### 4. One short functional check

Use an already-onboarded account to open Explore or send an AI message twice. A completed profile's requested purpose is cached lazily; a user without completed onboarding will correctly have no populated cache entry. Count entries without dumping preference contents:

```bash
redis-cli -p 6381 --scan --pattern 'ctx:prefs:v1:*' | wc -l
```

Edit FOOD_STYLE/ACTIVITY_INTEREST in Settings, save and request again. The new committed revision uses a different key immediately; old keys may remain until expiry, which is expected. A cache hit still checks lightweight DB metadata. Metrics are registered internally; actuator metrics are not exposed publicly by this change.

Rollback: set CONTEXT_PREFERENCES_CACHE_ENABLED=false and restart only Context; no Redis flush or DB rollback is required. Production activation is a separate deploy using the Compose service and an operator-provided CONTEXT_CACHE_KEY_SECRET.
