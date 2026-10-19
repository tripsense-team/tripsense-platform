# Observed History Unattributed Latency — Diagnosis & Fix Plan

`STATUS: IMPLEMENTING`

Human approved diagnosis implementation on 2026-10-19: “Tiến hành”.

- Date: 2026-10-19.
- Owner: `services/recommendation-service`.
- Potential supporting files: local monitor/analyzer/tests; Recommendation-only diagnostic configuration.
- Related: [existing diagnostics](./observed-history-diagnostics.md), [current intent policy](./observed-history-signal-quality.md), [section feed](./explore-for-you-category-sections.md).
- This request authorizes planning only. No application implementation, restart,
  live DB access or process recording was performed while preparing this plan.

## 1. Goal, evidence and acceptance

Find what actually consumes observed-history wall time before selecting a fix.
Preserve recommendation quality, ownership, event semantics and fallback behavior.

### Evidence, not assumed causes

Request `df752fc9-9eee-4cc2-9319-d0a661928b3c`, 15:24:10:

| Measurement | Duration |
| --- | ---: |
| Gateway / Recommendation | 10278 / 9623ms, HTTP 200 |
| Recommendation request start to profile-load marker | approximately 2156ms |
| resolve_context | 5736ms |
| observed_history | 4984ms |
| seen query / affinity query / profile compose | 312 / 214 / 36ms |
| Context HTTP call | 727ms |
| candidate retrieval | 1113ms |
| features / impression / response-cache write | 21 / 267 / 45ms |

Query and compose phases explain approximately 562ms of the 4984ms inclusive
history measurement: about 4422ms remains unattributed, NOT proven SQL latency.
The `observed_history_limit` marker at 15:24:12.941 and
`observed_connection_timing` at 15:24:16.702 are 3761ms apart. Timestamps are
observations, not proof of a particular operation's execution duration.

Earlier history samples: 683ms on the failed first request and 484ms after a
filter action. The 4984ms sample used the same Java PID; do not explain all
delays as process startup. Context Redis in this sample acquired in 8ms and
executed in 52ms; it is not evidence of a 5s Redis command.

### Current inspected implementation

- `RemoteRecommendationContextProvider.readObserved` wraps `historyReader.read`.
- Intent-v2 `JdbcRecommendationStore.read` runs two bounded sequential reads:
  shown-place IDs, then joined event/categories rows; the reducer composes a profile.
  Legacy mode still has three reads. Categories-only projection is already implemented.
- `observedQuery` times JdbcTemplate query inclusive of acquisition/result mapping.
  It does not separate pool acquisition from SQL/network.
- `RequestDiagnostics.mark` calls `LOG.info` directly. `Phase.finish` calculates
  elapsed BEFORE calling logger and recording the Micrometer timer. Thus diagnostic
  logging and metric work can be counted by an outer phase but omitted from the
  inner phase. This is an instrumentation gap, not proof the logger blocked.
- `scripts/start.sh` starts Maven/Spring Boot in Terminal and sets LOGGING_FILE_NAME;
  it does not pipe the application through tee. Verify effective appenders at runtime
  rather than assuming console/file configuration from the script alone.

### Acceptance criteria

- AC1: Report history wall time, JDBC-inclusive work, mapping/decode/compose,
  diagnostic logging/metrics overhead and residual without double-counting.
- AC2: Explain a reproduced multi-second outlier using correlated evidence, or
  explicitly report it was not reproduced; do not select a speculative fix.
- AC3: Isolate the approximately 2.16s pre-profile interval from history; do not
  fold it into SQL or expand to a Gateway/Context redesign.
- AC4: Preserve two reads in v2, three in legacy; SQL/limits/order/parameters,
  connection lifecycle, event interpretation, resulting profiles and auth unchanged.
- AC5: No per-row diagnostics or private values, unbounded event buffers, new
  public metrics/debug endpoints, cloud writes, retries or increased timeouts.
- AC6: At most one planned Recommendation restart for instrumented acceptance;
  no restart necessary for the initial read-only investigation.

## 2. Architecture and measurement design

Keep Web -> Gateway -> Recommendation and existing Context API unchanged.
Recommendation owns impression/feedback SQL and derived observed profiles.
No cross-service DB access, new service, Kafka event or consumer cache.

### Hypotheses and discriminating evidence

| Hypothesis | Evidence required before a fix |
| --- | --- |
| Console/file logger blocks request | Nano-time spent inside logger calls, bounded thread samples showing appender/output blocking, controlled local appender comparison |
| Metrics registration/recording stalls | Separate accumulated registry/timer duration; first-use versus warm samples |
| JVM pause, CPU contention or thread descheduling | Wall-versus-thread-CPU deltas, GC/safepoint events or safe thread samples; not subtraction alone |
| JDBC pool/acquisition stalls | Existing Hikari aggregate active/idle/pending plus stack evidence; scoped acquisition measurement only if safely implementable |
| SQL/result transfer or reducer really dominates | Query/mapping/decode/compose distribution; if query dominates, separately approved owner-scoped read-only plan inspection |

### Minimal instrumentation after approval

1. Use monotonic nano-time for durations. Capture a small fixed set of in-memory
   boundaries from history entry to before/after first marker, each query and
   composition, then history return. Do not insert a log at every boundary.
2. Accumulate logger-call elapsed time and metrics-record elapsed separately in
   request-local diagnostics. Time calls without recursively invoking diagnostics.
   Count calls, including nested phase-finish output. Label as client-side elapsed,
   not disk duration, CPU duration, pure appender time or pure pool wait.
3. Emit one bounded `observed_timing_summary` after history work has been captured:
   wall_ms, query_total_ms, compose_ms, diagnostic_log_ms, diagnostic_metrics_ms,
   residual_ms, event_count and optional thread_cpu_ms/unavailable. Keep nanoseconds
   internally for reconciliation; round only at output. Summary emission itself is
   outside its captured history interval and must be reported separately where
   feasible, never recursively timed/logged. Existing phase names remain supported.
4. Track nonoverlapping intervals. Mapping/decode are nested in query; logger and
   metrics can occur inside or outside other phases. Only subtract exclusive costs
   from their matching scope. Negative/ambiguous residual is an accounting error
   to investigate, not a value to silently clamp away.
5. Capture request-start -> feed-entry -> profile-entry timing without changing
   HTTP/auth/controller behavior. Do not claim filter time covers work before filter.
6. No global datasource proxy or new transaction merely to measure acquisition.
   Begin with existing pool metrics and stack evidence. If a narrow wrapper cannot
   preserve shared JdbcTemplate/transaction identity, retain the explicit limitation
   and seek approval for any broader JDBC instrumentation.

## 3. API and event contracts

No HTTP path, request/response DTO, status, identity header, auth or Kafka changes.
New diagnostic fields are internal, fixed-cardinality and correlated by the existing
validated request ID. Do not label metrics with request/user/place/session IDs.
If analyzer support is needed, add only safe fixed fields and repeated-event totals;
never sum inclusive parent/child phases as end-to-end latency.

## 4. Data model, persistence and runtime collection

No tables, indexes, migrations, history deletion, backfill, Redis flush or DB tuning.
Do not reread full feature_snapshot: lightweight category projection already exists.
Initial investigation uses existing local logs, effective appender topology, aggregate
process/pool statistics and synthetic test fixtures only; never dump environment,
command arguments, JDBC URLs, SQL parameters, heap or private profile contents.

After approval, bounded local thread sampling may target only the verified running
Recommendation PID while a user initiates a normal request: at most 10 samples over
10s, sanitized output in a private temporary directory, no automatic all-thread dump
into the chat. No CPU-intensive heap dump or indefinite profiler/watch.
If samples are insufficient, request explicit approval before JFR recording, since
recordings may retain broader process metadata. Never inspect other users' DB rows
to reproduce this account's request. Live SQL/EXPLAIN requires a separate scoped
read-only check if evidence points to SQL, not a default step.

## 5. Security and failure behavior

Authenticated owner resolution, intent-v2/legacy flag, declared Context preferences,
negative-place behavior, ranking and cache fingerprints remain unchanged.
No tokens, raw SQL/JSON, category values, owner/place IDs, connection strings or
exception messages in added output. Diagnostics must not swallow/replace JDBC errors,
alter fallback or leak ThreadLocal state between requests/workers. Disabled mode
must not acquire connections, register new per-request labels or perform extra I/O.

## 6. Fix selection and trade-offs

This approval covers diagnosis instrumentation/tests, not an arbitrary performance
redesign. Once the outlier is explained, present measured evidence and the smallest
fix for approval before changing runtime behavior:

- Logger confirmed: isolate high-volume diagnostics from request-thread console
  output with bounded buffering/dedicated async output or summary logging. Specify
  queue capacity, overload/drop counters, shutdown and rollback; preserve operational
  WARN/ERROR output. Never hide latency by silently disabling all logs.
- Metrics confirmed: move fixed timer registration out of hot paths/reuse handles,
  preserving cardinality and measured semantics.
- JVM/resource confirmed: address evidenced local resource pressure or expensive
  allocation; do not tune heap/GC or attribute everything to cold start without data.
- JDBC confirmed: distinguish pool contention, connection establishment, server and
  transfer before considering query/index/pool changes. Each requires a scoped plan.
- Reducer confirmed: optimize with fixed-clock profile-equivalence fixtures; no
  limit reduction, removal of observed signals or altered ranking weights.

Rejected now: add observed-profile Redis cache, disable history, raise deadlines,
parallelize Context/history, add indexes blindly, or change impression policy.
These may mask the underlying stall and change correctness/freshness or load.

## 7. Phases, tests and handoff

### A — Read-only baseline, no restart

- Correlate existing 15:19 and 15:24 requests; preserve first versus later requests,
  outcomes/PIDs and cache states. Identify timing gaps rather than selecting only
  successful filter requests. Inspect effective appenders without exposing config secrets.
- Check safe aggregate resource/pool evidence if available without enabling new public
  actuator endpoints. Report missing evidence explicitly.

### B — Diagnosis patch and synthetic verification

- Implement bounded nonrecursive timing accounting and summary with optional thread
  CPU support; no logging-backend/SQL/pool/ranking behavior change yet.
- Inject delayed logger appender, delayed metrics registry and JDBC callbacks in
  isolated tests. Verify time attribution even when inner query itself is fast.
- Cover intent-v2/legacy, empty and 5000-event fixtures, inactive diagnostics,
  error/partial results, cleanup, nesting, repeated phases, privacy and bounded memory.
- Use injected clocks/latches for deterministic accounting; avoid fragile unit-test
  millisecond SLAs. CPU counters must handle unsupported JVM/disabled readings safely.
- Run Recommendation regression excluding SemanticCloudIntegrationTest; analyzer
  tests only if touched; scoped formatter and whitespace checks. Synthetic/local
  fixtures only, no external provider, Qdrant or cloud mutations.

### C — One controlled local acceptance session

- Restart only Recommendation once with `bash scripts/start.sh` after stopping its
  existing terminal. Do not stop Place, Context, Gateway or Web.
- User performs three sequential equivalent requests in the same session, then one
  after a short idle period if needed. No rapid filter toggling or concurrent load.
  Record first/warm/idle labels and cache states; impression writes mean requests are
  not identical snapshots, so do not claim a controlled ranking-quality experiment.
- Agent reads logs directly; no manual UUID extraction or repeated restarts. Trigger
  bounded sampling only during this agreed session. If outlier does not reproduce,
  keep diagnosis open and report the coverage/limit rather than declaring it fixed.
- Deliver a timing breakdown and ranked, evidence-based cause(s), then propose the
  smallest fix and its trade-offs for user approval. Verify that fix separately with
  comparable samples, unchanged profile semantics and no new error rate.

Verification command (after implementation):

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```

Rollback: revert only this diagnostic patch/configuration, restart Recommendation
once if required; existing diagnostics and profile behavior remain. No data rollback.

## 8. Unified planning review

- Product: preserve useful personalized results; diagnose long-tail latency before
  weakening recommendation behavior. No arbitrary subsecond promise from one sample.
- Architecture: owner-local read path, no new service/cross-service persistence.
- API/events: unchanged; safe internal fields only.
- Database: no schema/SQL/transaction mutation during diagnosis.
- Security: bounded sanitized metadata, no heap/env/private-data dumps.
- Testing/operations: reproduce instrumentation stalls, avoid measuring only SQL,
  distinguish inclusive phases, limit restarts and require evidence before a fix.

## Human approval gate

Diagnosis approved; instrumentation implemented and automated verification passed.
Runtime acceptance and cause identification remain pending.

User approved phases A–C diagnosis. Runtime behavior changes selected
from the evidence require a follow-up approval; this document does not authorize
blind caching, logger reconfiguration, pool/SQL tuning or timeout increases.

## Implementation handoff (2026-10-19)

- Added `ObservedTiming`, an owner-thread-only constant-space scope around the existing
  observed-history reader. No propagation onto worker threads; current history is
  synchronous. Nesting does not create overlapping summaries, and finally restores
  scope on success/error. No per-row event accumulation or extra DB/Redis operation.
- Existing RequestDiagnostics logger calls and phase metric registration/recording
  are timed only while that scope is active. Query/compose exclusive values remove
  their nested measured diagnostic cost; residual remains signed, not clamped.
  Existing inclusive query/phase outputs retain their meanings and names.
- Fixed in-memory boundaries: first marker entry/exit and first seen-query entry,
  expressed as offsets from history scope start. `-1` means not reached. No added
  log at each boundary. Request-to-feed/profile checkpoints are inclusive from the
  diagnostic filter and overlap; do not sum them.
- One `observed_timing_summary` safe state with nanosecond accounting and an optional
  thread CPU counter (`-1` unavailable). Divide Ns by 1,000,000 for milliseconds.
  Query time still includes acquisition/transfer; CPU delta does not identify GC,
  network or pool wait by itself. A small CPU-sampling/scope-setup cost is outside
  this inner wall measurement but inside outer observed_history.
- Summary output occurs after scope capture/detach. `observed_summary_emit` reports
  elapsed emission of the summary state, excluding its own final log line. Both
  emissions and scope setup may contribute to outer observed_history; do not compare
  inner wall and outer history as identical scopes. Do not recursively log the cost
  of the final emission.
- Monitor follow mode already accepts the existing explore_state/phase shape.
  Analyzer preserves the summary without parsing/adding its nanosecond components;
  added request_to_ visibility. No new metrics labels, endpoints or dependencies.
- Baseline was inspected from existing logs/source: the 4.98s history outlier differs
  markedly from its 562ms query/compose sum; no live root cause yet proven. Source
  has direct logging calls and no service-specific checked-in Logback configuration;
  effective runtime appender blocking/pool pressure remains unverified. No attach,
  thread dump or JFR taken before the agreed runtime session.

### Automated verification and reviews

- **231 Recommendation tests passed**, zero failures/errors/skips, including 8 new
  accounting tests and existing architecture, reducer, legacy/v2 SQL/connection/profile
  tests. Active timing scope also exercised with real JdbcTemplate/mock transport.
- New tests use an actual test logger appender and Micrometer meter-registration
  callback with injected clock advances: attribute logging/metrics delays without
  flaky sleep thresholds; verify nested diagnostic subtraction, error cleanup, same
  exception/return, CPU-unavailable path, sequential query accumulation, bounded
  output with 5000 synthetic steps, no inactive output and signed accounting errors.
- **15 analyzer tests passed**, including summary preservation, request checkpoints
  and request isolation. Scoped Spotless application and diff whitespace check passed.
- Architecture/database/security/PR self-reviews: no blocking findings. No SQL,
  transaction, auth, schema, ownership, algorithm, cache or timeout changes. Existing
  logging behavior is measured, not reconfigured. No live cloud mutation, environment
  edit, service restart or semantic-cloud integration test was performed.

### User session

1. Stop **only Recommendation** in its current terminal using Ctrl+C.
2. From repository root run `bash scripts/start.sh`; other listening services stay up.
3. Reload For You once, then trigger two more sequential requests with the same
   destination/filter/session. Wait for each to finish; browser memory reuse may
   make no HTTP request, so explicitly reapply the same filter if needed. Do not
   toggle different categories rapidly. No need to copy request IDs manually.
4. Tell the agent when done. Agent reads local logs and distinguishes first/later
   request IDs, response codes and cache states, then reports the accounting and
   proposes an evidence-backed fix. If the multi-second gap does not reproduce,
   state that limitation; do not declare it fixed.
5. Bounded sanitized thread sampling is reserved for a coordinated reproduction if
   accounting still leaves a large residual; no JFR without separate approval.
