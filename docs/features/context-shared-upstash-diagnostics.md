# Context Shared Upstash & Diagnostics — Specification & Implementation Plan

`STATUS: DONE`

Approved reliability correction 2026-10-19 (user: “Tiến hành sửa”): retain the 100ms
steady EVAL/SET command deadline, but give connection/activation/TLS a separate 800ms
default budget (validated max2s). Spring/Lettuce's URI/activation timeout must not reuse
the 100ms steady command deadline. Apply activation budget only to HELLO/AUTH/SELECT/
CLIENT/PING commands; normal cache commands retain their configured short timeout.
After a Redis failure skip immediate write attempts until successful read/recovery or
the existing failure backoff expires. No disabled TLS verification, extra foreground
retry, production topology or Recommendation deadline change. Verify delayed activation
and steady command timeout with a disposable local Redis proxy; cloud acceptance pending.

### Reliability correction — verification and acceptance

- Activation default is now 800ms; ordinary EVAL/SET remain 100ms. Existing finite
  limits, TLS verification, safe error taxonomy and DB fallback remain enabled.
  A failed read suppresses immediate writes during failure backoff, avoiding a second
  connection attempt to populate an optional cache after the same failure.
- Context: **57 tests passed**, including a disposable localhost Redis proxy that
  delays activation by 250ms: activation succeeds while a later ordinary command
  delayed 250ms still times out. Existing Redis corruption/OOM/restart and disposable
  PostgreSQL tests passed. Place 130 + Recommendation 223 also passed (410 total).
  Cloud semantic test excluded. An initial combined Maven run failed at Context test
  discovery with ClassNotFoundException; the separate full rerun passed.
- Architecture/database/security/PR self-review: no API/schema/auth or ownership
  changes; no credentials or cached personal values added to logs; no blanket command
  deadline increase or TLS bypass. No live Redis/DB mutations or environment edits.
- Runtime acceptance for this patch: restart **only Context and Place** in their
  existing terminals, then run `bash scripts/start.sh`. Recommendation/Gateway/Web
  need not restart. Fully reload browser, request For You twice; inspect
  `logs/context-service.log` for acquisition/command outcomes and later cache hit
  on the same eligible profile/revision/purpose. No cache flush/backfill required.
  The tests prove the timeout split, not that every Upstash connection will fit 800ms
  or that total request time meets a particular SLA. Cloud latency acceptance pending.

Human approved on 2026-10-19: “Duyệt”.

- Created: 2026-10-19.
- Owner: `services/context-service`.
- Affected: Context diagnostics, scripts/start.sh, monitor/analyzer/tests, local
  gitignored configuration. No Recommendation/AI contracts or ranking changes.
- Related: [Demand cache](./context-preferences-demand-cache.md), already DONE.
- This is an explicit local-development exception to that plan's dedicated Redis
  deployment choice. Do not silently change production Compose's dedicated default.

## 1. Goal, evidence and acceptance

Enable the existing Context projection cache against the same Upstash database
as REDIS_URL and measure its actual benefit, not assume Redis removes DB latency.

Verified read-only on 2026-10-19:

- Running Context env has no cache enable flag, URL or valid secret and no alternate
  config overrides observed; cache defaults false. Missing local Redis6381 is not
  evidence that other services aren't using Upstash.
- REDIS_URL endpoint matches the screenshot's personal-workspace database, TLS
  PING succeeds. DBSIZE returned 1565 keys at inspection time.
- INFO memory unavailable; CONFIG GET maxmemory-policy returned no value. Eviction
  policy/capacity behavior unconfirmed. No CONFIG SET/FLUSH/SET/DELETE performed.
- Bounded SCAN: five pages / 500 observations, incomplete; no sampled keys matched
  ctx:prefs:v1 or rec:explore. This is NOT proof those namespaces are absent.
- CLI wall-clock PING577ms, DBSIZE210ms include separate process/connection/TLS
  overhead, not pure server time or expected pooled Java latency.
- Recent warm search has Context492–651ms; current logs don't prove cache hit/miss.

Acceptance: first eligible preferences read populates cache, subsequent same
owner/revision/purpose reads can hit; post-save uses new revision; logs explain
metadata/Redis/signal load timings; failure still falls back within bounded limits.
No guarantee of lower latency, memory isolation, or million-user capacity.

## 2. Architecture and scope

Keep Context as sole cache owner. Web/Gateway/Recommendation/AI continue through
Context API, never read its Redis entries directly. Settings onboarding editing
stays DB-backed. No cross-service DB/JPA, new microservice, Kafka or schema work.

Local activation keeps a separately named CONTEXT_CACHE_REDIS_URL, explicitly
assigned the same value as REDIS_URL. Do not add implicit application fallback
to REDIS_URL or alter Place/Recommendation configuration. Keep HMAC key namespace,
payload validation, fixed TTL jitter8–12min, size64KiB/200signals, admission,
single-flight, version checks and circuit fallback unchanged.

Shared namespace prevents name collisions, NOT shared memory/eviction/throughput
effects. Do not issue CONFIG SET/maxmemory/eviction changes, flush commands,
unbounded KEYS, global scans or read other services' values. No new database.

### Minimal safe diagnostics

Context-owned request filter/utility for GET /api/context/preferences only:
validate or generate bounded X-Request-ID using existing diagnostic conventions,
propagate response ID, always clean ThreadLocal on success/error. Recommendation
already forwards that header to Context. AI requests without an ID get a local one.
Do not introduce a Context dependency on Recommendation code.

Reuse explore_request_started/completed, explore_phase, explore_state log shape
with service=context-service so existing local tools can correlate requests.
Fixed statuses hit/miss/bypass/coalesced/unavailable/draft as applicable, signal
count and cache enabled state. No high-cardinality user labels in metrics.

Phases: context_metadata, context_cache_get, context_cache_put,
context_snapshot_load, context_profile_query, context_catalog_query,
context_signals_query, context_admission_wait, context_coalesced_wait. Parent/child
overlap must be documented. JDBC query phases include connection/transfer/mapping;
not pure server time or isolated pool wait. Redis adapter failures that become
safe misses must be visible as safe fixed states, not mislabeled clean hits.
Do not log every row or signal.

Add Context to file logging in scripts/start.sh. Include its file optionally in
monitor-explore.sh so absence doesn't require restarting other services. Extend
analyzer state allowlist for context_ fields and preserve request ID filtering,
repeated event aggregation and inclusive timing warning. No public metrics/env
endpoint exposure; existing unauthenticated actuator exposure stays health/info.

## 3. Contracts and configuration

No HTTP path, payload, authentication, event, DB schema or User field changes.
Only the existing X-Request-ID diagnostic header and new bounded internal logs.
Retain current purpose validation and current-owner resolution before cache access.

Local gitignored env activation (values never printed/committed):

```text
CONTEXT_PREFERENCES_CACHE_ENABLED=true
CONTEXT_CACHE_REDIS_URL=<same endpoint and credentials as existing REDIS_URL>
CONTEXT_CACHE_KEY_SECRET=<stable fresh backend-only secret, at least 32 chars>
```

Preserve a valid existing secret on reruns. Generate securely if absent, update
only intended keys without exposing the env file or secret in outputs/diffs.
If using a helper, make it explicit/idempotent with redacted check output and
tests using synthetic env fixtures; don't duplicate/cache plaintext credentials
in a tracked file. Verify env/.env remains gitignored. No real credentials in tests.

Keep base application command100ms/connect200ms defaults initially; local cloud
overrides may be introduced only from actual failure/timing evidence, documented
within validated existing ranges (command<=1s/connect<=2s). Do not silently make
timeouts unbounded or disable circuit fallback. Avoid claiming cold CLI timings
are equivalent to Java command timeout requirements.

## 4. Persistence and operational boundaries

Context writes only its existing HMAC-addressed TTL cache entries after auth and
revision validation; no migration, index, new persistent data or user data edits.
Hits still perform lightweight DB metadata reads; misses can perform both metadata
check and full snapshot load, so cache may not improve this tiny projection enough.
Retain transaction/isolation/connection behavior exactly while instrumenting.

After approval, at most one diagnostic transient probe in an explicitly owned
ctx:probe namespace with <=30s TTL may verify shared backend SET/GET support;
no unrelated values or keys touched. Prefer existing disposable Redis fixtures
for corruption/OOM/outage tests; never alter the shared Upstash policy for tests.
No changes to existing Upstash plan/billing/ACL, production Redis container or topology.

## 5. Security

Owner comes from auth, unsupported purposes remain safe400. Reject/internally
replace invalid request IDs to prevent injection. Log no owner/place IDs,
preference values, JSON, authorization headers, Redis key names, credentials,
endpoint URLs or raw upstream errors. A secret validity boolean is sufficient.
No management endpoint that leaks env/config or forces live cache invalidation.

## 6. Trade-offs and rollback

- Shared Upstash is least deployment work but has no dedicated memory reserve.
  Unknown eviction policy and observed11MB dashboard storage aren't proof of
  spare guaranteed capacity. OOM/eviction must degrade to existing bounded DB fallback.
- Feature disabled locally today; enabling adds real cache entries and commands,
  counted against the shared account's limits. Short-lived dev trial, not scale signoff.
- Cloud RTT may outweigh one saved query; measure warm hit vs bypass honestly.
- Miss tracing adds bounded log overhead; keep independently configurable
  diagnostics flag and no public dashboard project.
- Disable cache flag and restart only Context to rollback activation. Old Context
  entries expire; no flush/delete required. Other services stay configured as before.
- Production shared-cache rollout remains a separate operator decision; don't
  remove dedicated context-cache container or repoint production implicitly.

## 7. Tasks and verification

- [x] Context safe request diagnostics + filter, nested timing and cache-outcome states.
- [x] Local script/analyzer optional Context integration and synthetic tests.
- [x] Tests for no scope leakage across requests, invalid IDs, success/error cleanup,
      hit/miss/bypass/circuit errors, ownership/purpose, unchanged HTTP arrays and
      no personal values or credentials in logs. Instrumentation must not alter calls.
- [x] Existing Context cache/concurrency/Postgres/Redis tests remain green; use
      opt-in disposable localhost integration fixtures, not shared cloud destructive tests.
- [x] Existing Recommendation offline suite remains green; no cloud semantic test.
- [x] Scoped formatter, script tests, Compose validation if touched, diff check;
      architecture/database/security/PR self-reviews.
- [x] Redacted local env preparation after approval, explicit shared URL and stable
      valid secret, preserve unrelated env contents. No service restart until handoff.
- [x] Provide handoff for one Context restart via existing script; user triggers two preferences
      reads and a Settings save. Agent reads local logs directly. A completed cache
      hit and a new-revision read are manual acceptance, not inferred from tests.

## 8. Implementation report (2026-10-19)

Implemented after human approval. Runtime cache-hit/Settings-save acceptance is
pending the user's one-restart handoff, not claimed from automated tests.

### Delivered

- Context-owned ContextDiagnostics and GET-preferences-only filter: safe propagated
  IDs, optional context.diagnostics.enabled flag (CONTEXT_DIAGNOSTICS_ENABLED),
  fixed events and finally cleanup; no dependency on Recommendation code.
- Facade traces enabled state, hit/miss/bypass/load/coalesced/not_completed,
  returned signal count, metadata/get/put/load/admission/follower timing. Multiple
  outcome lines represent processing stages, not one mutable terminal status.
- Loader traces the original profile/catalog/signals queries without changing SQL,
  transaction isolation, query counts or connection behavior. Parent timings include
  transaction overhead; query timings do not isolate network from server execution.
- Redis adapter fixed outcome states include error/corrupt/bypass/uncacheable/write.
  Safe handled transport failures can leave an outer cache_get phase successful
  because fallback worked; context_redis_outcome=error records the transport failure.
- start.sh writes Context logs; monitor includes Context optionally; analyzer retains
  context_ states and existing inclusive timing/request filtering behavior. Missing
  Context log does not request a restart of all services.
- Added explicit prepare-context-cache.mjs: check mode read-only, --apply updates
  only Context settings, rejects symlinks/unsupported interpolated URLs, atomic
  private file replacement, preserves valid secret and unrelated settings. Synthetic
  tests cover idempotency, failures, CRLF and no credential output.
- Local env/.env prepared, gitignored, private mode0600. Context flag true, URL
  explicitly equals existing REDIS_URL, fresh stable secret generated privately.
  Existing process has NOT been restarted, so these values take effect at restart.
  No timeout overrides, production topology changes or public actuator exposure.

### Verification

- **52 Context tests passed, zero failures/errors/skips**, including actual disposable
  localhost Redis and PostgreSQL fixtures and 9 new diagnostics tests.
- **200 Recommendation offline tests passed**, zero failures/errors/skips;
  SemanticCloudIntegrationTest explicitly excluded, no Qdrant/provider calls.
- **13 analyzer + 2 monitor + 4 config-helper tests passed** (19 script tests).
- Scoped Spotless, bash -n and scoped git diff --check passed. Unrelated existing
  whitespace findings elsewhere in the worktree were not modified.
- Security/architecture/database/PR self-reviews: no blocking findings; auth and
  existing cache correctness retained, no cross-service persistence or schema change.
- Exactly one random ctx:probe key was written on shared Upstash, TTL30s, no user
  data. SET NX, GET, bounded Lua read and positive TTL verified. Key name/credentials
  not printed; no other keys deleted/read for values, no flush/config mutation.
  All corruption/OOM/outage tests used disposable Redis, not shared Upstash.
- Shared probe is CLI transport validation, not proof of pooled Java cache hits
  under existing100ms/200ms timeouts. Tune only from actual runtime trace evidence.

### Manual acceptance (one restart)

1. Stop only the Context service Terminal process using Ctrl+C.
2. Run bash scripts/start.sh from repository root. Other listening services are skipped.
3. Open For You/search and make two requests without editing Settings between them.
   Agent reads logs/context-service.log directly; optional monitor command remains
   bash scripts/monitor-explore.sh --follow (start it after Context log exists).
4. Expect context_cache_enabled=true; first request may miss/write; a later request
   with the same completed profile/revision/purpose should hit. Circuit errors are
   visible as context_redis_outcome=error/bypass. A draft/no profile returns empty
   without caching and is not a cache malfunction.
5. Save a changed preference in Settings, request again; verify new committed revision
   is loaded, not old cached signals. Inspect safe counts/outcomes, never log values.

Rollback: set CONTEXT_PREFERENCES_CACHE_ENABLED=false in local env and restart only
Context. Keep the secret stable if re-enabling. Entries expire normally; never flush
shared Redis. No end-to-end latency or user-quality improvement claimed yet.

### Follow-up: Redis failure trace (2026-10-19)

User explicitly requested tracing Context Redis connection/command failures. Existing
request-local diagnostics now record operation (`eval_bounded`, `set`, `delete_corrupt`),
connection acquisition/callback-command/total elapsed milliseconds, configured timeout
budgets, failure stage and a bounded error taxonomy. Circuit closed/open/half_open is
visible, including bypasses. Fixed-cardinality failure counters have no owner/key labels.
No exception messages, stack traces, endpoint credentials or Context values are logged.
Cause traversal is bounded and cycle-safe; only fixed auth/ACL prefixes are inspected
internally. No extra Redis operation, timeout change, retry or cache behavior change.

`acquire` means before entering Spring's Redis callback; `command` means inside it.
These are client-side boundaries, not wire-level Redis server execution measurements:
lazy driver connection work can still occur within a command. TLS/DNS/auth/command
timeout categories provide evidence without claiming separate TCP/TLS stage timings.

Read-only local configuration check passed. Three fresh TLS/auth/PING CLI probes to the
configured Context endpoint succeeded (297/207/179ms total process/connection/command
time). These probes do not reproduce Java pooling or prove a cache hit. No shared
keys were read, written or deleted. The sandbox-restricted initial attempts could not
reach the endpoint; only the permitted network probes above are runtime evidence.

Verification: 22 targeted cache/config/diagnostics tests passed, covering nested
error classification, safe log output, acquisition versus command failures and existing
cache/circuit behavior. Full Context suite with disposable localhost Redis/PostgreSQL:
54 tests passed, zero failures/errors/skips. Architecture/database/security self-review:
no API, schema, ownership or authentication changes; no raw upstream exception logging.
Runtime acceptance still requires restarting **only Context**
once to load this trace, then two For You requests; inspect `logs/context-service.log`
directly. Do not infer the root cause or change timeout defaults before this evidence.

Verification command:

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/context-service,services/recommendation-service -am test -Dcontext.cache.integration=true '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```
