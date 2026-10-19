# Observed History Diagnostics — Specification & Implementation Plan

`STATUS: DONE`

Human approved on 2026-10-19: “Triển khai”.

- Date: 2026-10-19.
- Owner and affected application: `services/recommendation-service`.
- Related: [Context-owned personalization](./context-owned-personalization.md).

## 1. Goal and scope

Explain the observed_history duration of 1649 ms in request
222d9074-7193-4e04-9b2a-73cca95fc3f0 without changing recommendation behavior.
Current JdbcRecommendationStore.read executes three sequential JDBC queries,
maps feedback, parses feature_snapshot JSON and composes a profile. Existing
diagnostics measure only their aggregate. Actual row counts and query timings
are not yet known; the default 5000 limit is not evidence of 5000 returned rows.

In scope: bounded per-request phase timings and counts using RequestDiagnostics,
regression tests, and minimal local verification instructions.
Out of scope: query/index changes, new transactions, altered connection reuse,
cache, concurrency changes, event ingestion, ranking weights, history limits,
data deletion, schema changes and frontend changes.

Acceptance: identify time spent in each query and connection acquisition versus
mapping/composition; preserve outputs, SQL order, parameters, fallback and errors.

## 2. Architecture and measurement semantics

Keep diagnostics in the existing Recommendation persistence boundary. Reuse
request IDs and fixed phase names. No new service or cross-service storage access.

Proposed phases:

| Phase | Meaning |
| --- | --- |
| observed_history | Existing inclusive outer measurement, retained |
| observed_seen_query | First query including acquisition, transfer and row processing |
| observed_feedback_query | Second query including acquisition, transfer and row processing |
| observed_affinity_query | Third query including acquisition, transfer and row processing |
| observed_connection_acquire | Scoped actual JDBC connection acquisition; may occur three times |
| observed_profile_compose | Normalization and multi-timescale composition after queries |

Instrument acquisition only around the original JdbcTemplate DataSource access
for this read path, using a narrow delegating adapter if needed. Do not eagerly
open a probe connection, introduce a transaction, force all queries onto one
connection, replace global datasource wiring, or change pool configuration.
Acquisition timing includes pool wait and any connection establishment/validation;
it is NOT pure pool wait or PostgreSQL execution time. If callbacks cannot expose
this safely, report the limitation rather than infer it by subtraction.

Within the third query, accumulate feature_snapshot decode duration with
System.nanoTime and emit one aggregate value, not a log/timer per row. Accumulate
row counts for all three queries and resulting set/category sizes. Query timings
include row callbacks; decode and acquisition are nested, not additive phases.
Repeated acquire events must be summed, not overwritten, in any script summary.
Inspect existing analyzer behavior; update it only if needed for these events.

These client-side measurements do not separate server execution from network
transfer. EXPLAIN ANALYZE/live DB access is not part of this implementation.

## 3. API and events

No HTTP DTO, route, authentication, Kafka topic or event changes. Existing
explore_phase and explore_state log contracts remain unchanged. New names are
fixed constants; no dynamic metric labels, users, places or SQL in log fields.

## 4. Persistence

Read only the same Recommendation-owned tables with the exact existing SQL,
limits, ordering and parameters. No migrations, index changes, writes, extra
COUNT queries or data inspection beyond existing result processing.

## 5. Security and failure behavior

Log only durations, row counts, aggregate sizes and safe fixed statuses. Never
log UUID owners, place IDs, preferences, raw JSON, SQL parameters, JDBC URLs,
credentials or exception messages. Keep request ID sanitization unchanged.
Do not swallow, replace or retry JDBC failures; existing history fallback stays.
Timing scopes close in finally, and scoped state is cleaned on success/failure.
Outside active diagnostics avoid extra connection work and per-row logging.

## 6. Trade-offs

Diagnostics have small CPU/log overhead, especially on cold starts; no single
sample establishes steady-state latency. Compare two equivalent requests without
restarting between them. Do not label the first request definitively cold merely
from timing. Existing migrations contain indexes, but live query plans are unknown.

Do not optimize before measurements; observed profile caching and behavioral
quality review require a separate later decision.

## 7. Tasks and verification

- [x] Add scoped measurements, counts and bounded JSON decode aggregate.
- [x] Tests: unchanged profile output and three SQL calls/parameters/order;
      empty history, parse failures, JDBC/acquisition failures, proper connection
      release, no extra acquisition, no instrumentation leakage between requests.
- [x] Verify timings emitted only with active request diagnostics and error
      outcomes are preserved. Avoid tests asserting wall-clock thresholds.
- [x] Check monitor/analyzer handles the new phases and repeated events; test
      aggregation if changed. Existing follow mode already includes these events.
- [x] Run offline Recommendation tests, excluding SemanticCloudIntegrationTest;
      run scoped formatting and git diff --check. No provider/Qdrant writes.
- [x] Self-review architecture, DB ownership, safe logging and regression scope.
- [x] Provide handoff instructions: restart only Recommendation once, perform two Explore requests,
      inspect local logs directly. No all-service restart or manual ID required.

Verification command (JDK 21; same offline setup as previous work):

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```

Rollback: revert only diagnostics changes; no data or environment rollback needed.

## Implementation and verification report

Completed 2026-10-19 after human approval. JdbcRecommendationStore.read retains
the original three SQL statements, call order, limits, callbacks and shared
JdbcTemplate/DataSource. There are no connection probes or new transactions.

As allowed by Section 2, direct acquisition timing was not added: safely exposing
that hidden JdbcTemplate step would require broader datasource interception or a
different execution path. The explicit state
`observed_connection_timing=included_in_query` documents the limitation. Do not
interpret query time minus mapping time as pure server execution or pool wait.
This implementation can identify which query dominates, but cannot yet prove
whether that query's remaining latency is connection wait, server or network.

Added per-query phases, fully processed row counts, accumulated row callback ms,
snapshot decode count/ms, final set/category sizes and profile compose timing.
Partial counts are emitted on failure. Decode is nested inside affinity mapping,
which is nested inside the query phase; all are inside observed_history.
No per-row log output, personal values, SQL parameters or exception messages.

Analyzer summary now includes observed_ states. Existing inclusive phase
aggregation retains all events and their count/total; no changes to follow mode.

Verification:

- Offline Recommendation suite: **169 tests, 0 failures/errors/skipped**, including
  **7 new diagnostics tests** with real JdbcTemplate and mocked JDBC transport.
- Analyzer: **12 tests passed**, including observed counts and request filtering.
- Scoped Spotless and git diff --check passed.
- No live database, Redis, provider, Qdrant or user data touched. No service restart.
- Architecture/database/security/PR self-reviews: no blocking findings. No API,
  schema, SQL, transaction, ranking or service-boundary changes. Connection and
  statement release, acquisition failure, query failure, row failure, parse
  fallback, empty data, inactive diagnostics and request isolation covered.

### Local handoff

1. Stop only the existing recommendation-service Terminal process with Ctrl+C.
2. From repo root run `bash scripts/start.sh`; it skips already-running ports.
3. Open For You and make two requests without restarting between them. Avoid
   changing filters/account so the samples remain comparable; cache can still
   legitimately differ because impressions update the profile fingerprint.
4. Tell the agent requests are done; inspect logs/recommendation-service.log
   directly. Optional live view: `bash scripts/monitor-explore.sh --follow`.

Live timing diagnosis remains pending the user's requests; automated tests do not
establish the cause of the previously observed 1649 ms.

## Follow-up read-only investigation (2026-10-19)

User authorized proceeding with snapshot-size and execution-plan checks after
the new log reported affinity 1211 ms / 1165 rows, mapping 94 ms (including JSON
decode 67 ms), and observed total 1546 ms. No application optimization authorized
or performed in this investigation.

Connected to Recommendation's configured DB with credentials kept out of output.
Trace request ID is not the same as persisted recommendation request ID; resolved
the owner through the unique impression in the matching header-insert timestamp
window, confirmed 48 associated items. Did not select another user's history.
At measurement time this owner had 1179 feedback events (14 more than the log),
so measurements are representative follow-up samples, not replay of identical
historical data. No owner/place IDs or JSON content exported in the report.

All statements used BEGIN READ ONLY, local statement timeout 8s, lock timeout 1s,
and ROLLBACK. Queries were limited to the existing 5000-event window. No schema,
index, event, configuration or service restart changes.

### Server plan and payload

Two EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) samples of the affinity SELECT:

- Execution 3.167 ms and 2.839 ms; planning 1.896 ms and 1.145 ms.
- 1179 rows; idx_feedback_user_occurred used on feedback; hash join scans 3565
  impression items. In-memory quicksort 321 KiB, hash single batch, shared hits.
- Inspection confirmed feedback user/time index and item composite primary key.
- Diagnostic SQL resolves owner via a scalar timestamp subquery (small extra
  InitPlan); not the application's bound-parameter/generic-plan execution path.
- EXPLAIN does not measure normal full result serialization and transfer to the
  application; these timings must not be directly subtracted from the old log.

Aggregate size over the same limited result:

| Measurement | Value |
| --- | ---: |
| Full feature_snapshot JSON text | 3,049,762 bytes |
| Average / maximum full JSON text per row | 2587 / 3480 bytes |
| Only place.categories JSON text | 65,463 bytes |
| Average stored snapshot size | 2111 bytes |

Categories are about 2.15% of full JSON text, approximately 46.6x smaller.
These are JSON-field sizes, not exact wire bytes; event columns/protocol add more.

### Same-connection fetch comparison

psql on the same read-only connection, normal SELECT results sent to /dev/null,
only timing printed; alternating order in round 2. Identical event fields, joins,
owner and limit; only projection changes from feature_snapshot to
feature_snapshot->'place'->'categories'. No application SQL changed.

| Round | Full snapshot | Categories only |
| --- | ---: | ---: |
| 1 | 1390.764 ms | 164.386 ms |
| 2 (categories first) | 1592.867 ms | 164.159 ms |
| 3 | 1325.719 ms | 114.181 ms |

Evidence strongly implicates unnecessary full JSON materialization/transfer and
client handling rather than a second-long join in these server-plan samples.
psql is not JDBC: samples do not isolate network from server serialization or
client formatting, do not measure pool wait, and do not guarantee endpoint gains.

Recommendation for a separately approved optimization: project categories only
for affinity loading, preserve event columns and all existing profile semantics,
and verify equivalence for missing/null/non-array/malformed category shapes.
Do not add a cache, new index, reduce history limit or alter ranking weights based
on this evidence alone. Validate end-to-end using existing diagnostics afterward.
