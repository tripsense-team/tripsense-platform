# Recommendation Indexing Before/After Demo Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

- **Related feature**: [Durable Place Recommendation Indexing](./durable-place-recommendation-indexing.md)
- **Affected runtime components**: `services/place-service`, `services/recommendation-service`, Place MongoDB, Qdrant
- **Planned artifacts only**: local benchmark runner, isolated demo Compose configuration, raw result files, comparison report
- **Application code changes**: none in the first demo phase

## 1. Goal

Produce a repeatable, visible demonstration that compares the Place-to-Recommendation indexing flow before and after the durable indexing optimization. The demo must prove results from real runtime observations and must not use hand-written or generated performance numbers.

The comparison has two independent outcomes:

1. **User-facing performance**: Place Detail latency, throughput, errors, CPU, and memory under the same workload.
2. **Background efficiency and correctness**: internal indexing requests, embedding calls, Qdrant operations, queue convergence, retry, and recovery after an outage.

The old Place Detail path schedules indexing asynchronously, so the plan does not assume that every individual HTTP response becomes dramatically faster. A valid result may be a small latency change but a large reduction in hidden downstream work.

## 2. Scope

### In scope

- Compare `before` from the committed baseline and `after` from the optimized working tree.
- Build and run both revisions as isolated local stacks without changing either implementation.
- Use the same sanitized Place dataset, JVM settings, CPU/RAM limits, warm-up, concurrency, request count, and cache state.
- Store raw benchmark output so the result can be independently checked.
- Provide a short live demo using terminal output, MongoDB Compass, Qdrant dashboard, and a request-counting local embedding stub.
- Demonstrate normal load, a repeated-read load, mutation bursts, and downstream outage recovery.

### Out of scope

- Changing production code solely to make the demo look better.
- Calling paid Gemini during the repeatable benchmark.
- Comparing different machines, datasets, cache states, or resource limits.
- Claiming cloud cost savings from local currency estimates. The demo reports avoided call counts; billing conversion is separate.
- Tuning recommendation ranking, retrieval quality, or public Explore endpoints.

## 3. Comparison Topology

```text
same benchmark workload
        |
        +--> BEFORE stack: committed baseline, isolated ports/Mongo/Qdrant
        |
        `--> AFTER stack: optimized working tree, isolated ports/Mongo/Qdrant

both stacks --> local embedding stub with separate counters
             --> raw JSON/CSV result files
```

Isolation requirements:

- Different container names, networks, ports, Mongo databases, and Qdrant collections.
- Fixed container CPU and memory limits.
- The same service configuration except values required for isolation.
- The same initial Place documents and Qdrant state restored before every measured run.
- `before` and `after` run sequentially for the formal benchmark to avoid host contention; side-by-side mode is reserved for the visual walkthrough.

The exact baseline commit must be recorded in the report. For the current uncommitted optimization, the expected baseline is `HEAD`; this must be verified from the diff before execution.

## 4. Measurement Scenarios

### Scenario A — Place Detail repeated reads

- Warm both stacks first.
- Request the same existing Place Detail with concurrency `1`, `10`, and `50`.
- Run at least three measured rounds per concurrency and alternate execution order.
- Report median across rounds for latency and throughput; retain every raw round.

Measure:

- HTTP `p50`, `p95`, `p99`, maximum latency, requests/second, and error rate.
- Place and Recommendation CPU/memory.
- Internal Recommendation indexing requests.
- Embedding requests and Qdrant reads/writes caused by read-only traffic.

Expected invariant for `after`: repeated reads create zero index jobs and zero Recommendation indexing calls.

### Scenario B — Semantic mutation burst

- Apply a controlled series of semantic updates to the same Place, then to a fixed set of Places.
- Measure the user-facing mutation response separately from background convergence.
- Observe the Place-owned `place_recommendation_index_jobs` collection until it drains.

Measure:

- Mutation response latency and error rate.
- Number of jobs created and coalesced.
- Internal batches, embedding items, Qdrant upserts, and time-to-latest-indexed-version.
- Final Qdrant `sourceVersion`, proving that the latest canonical revision won.

### Scenario C — Recommendation/embedding outage

- Stop or make the local embedding dependency fail for a controlled interval.
- Perform a semantic Place mutation during the outage.
- Restore the dependency without manually reissuing the mutation.

Visible proof for `after`:

- Place mutation still succeeds.
- Mongo job remains `PENDING` or returns from `IN_PROGRESS` with a retry time.
- Attempt count/backoff changes can be inspected.
- The job drains after recovery and Qdrant reaches the latest version.

The baseline is expected to log and discard fire-and-forget failure; the demo must verify actual behavior rather than pre-fill this result.

### Scenario D — Restart recovery

- Stop Place Service after a job is claimed, then restart it after the lease expires.
- Show that the job is reclaimed and converges without resubmitting the user request.

This scenario proves reliability, not raw speed, and must be reported separately from latency.

## 5. Visual Demo Script

Target duration: 8–10 minutes.

1. Show the two immutable revision identifiers and identical runtime limits.
2. Open four views: benchmark output, service logs, MongoDB Compass job collection, and Qdrant dashboard.
3. Run repeated Place Detail reads against `before`, then `after`; show latency percentiles and actual downstream counters.
4. Run the mutation burst on `after`; show one latest desired revision, queue drain, and final Qdrant payload.
5. Disable the downstream stub, make one mutation, and show that the request succeeds while the job waits.
6. Restore the stub and show automatic retry and convergence.
7. Open the generated comparison report and the raw result files used to calculate it.

## 6. Evidence and Report Format

The report must leave all result cells blank until a benchmark has actually run.

| Metric | Before | After | Difference | Evidence |
| --- | ---: | ---: | ---: | --- |
| Place Detail p50 | TBD | TBD | TBD | raw benchmark JSON |
| Place Detail p95 | TBD | TBD | TBD | raw benchmark JSON |
| Place Detail p99 | TBD | TBD | TBD | raw benchmark JSON |
| Throughput | TBD | TBD | TBD | raw benchmark JSON |
| Error rate | TBD | TBD | TBD | raw benchmark JSON |
| Internal index calls from reads | TBD | TBD | TBD | stub/access counter |
| Embedding items | TBD | TBD | TBD | stub counter |
| Qdrant operations | TBD | TBD | TBD | access counter/dashboard |
| Latest-version convergence time | TBD | TBD | TBD | timestamped evidence |
| Mutation recovered after outage | TBD | TBD | n/a | Mongo/Qdrant evidence |

Every report records:

- Git revision and dirty-tree fingerprint for each build.
- Host, Docker, JVM, CPU/RAM limit, and test timestamp.
- Dataset checksum, cache preparation, concurrency, duration, and round order.
- Raw command and raw output paths.
- Any invalid round and the reason it was discarded.

## 7. Acceptance Criteria

- [ ] The team can reproduce the comparison from documented commands on the same environment.
- [ ] No application source is modified for demo phase 1.
- [ ] Before and after use verified revisions, isolated state, identical fixtures, and identical resource limits.
- [ ] At least three measured rounds exist for every latency scenario, with warm-up excluded.
- [ ] Raw results are retained and the comparison report is derived from them.
- [ ] After produces zero index jobs/internal index calls for read-only Place Detail requests.
- [ ] User-facing Place Detail `p95` does not regress by more than 5%; any improvement is reported as measured, not assumed.
- [ ] After coalesces repeated same-Place semantic changes and Qdrant ends at the latest source version.
- [ ] A transient downstream outage does not fail the Place mutation and the queued change converges after recovery.
- [ ] No real Gemini credential, internal API key, JWT, or raw provider error appears in artifacts or screen recordings.

## 8. Security and Data Handling

- Use synthetic or sanitized Place fixtures only.
- Use a local OpenAI-compatible embedding stub returning deterministic vectors of the configured dimension.
- Keep internal keys in ignored local environment files and redact authorization headers from logs.
- Do not expose internal indexing endpoints through the API Gateway.
- Do not commit benchmark output containing host usernames, tokens, or production URLs.

## 9. Implementation Tasks After Approval

1. Freeze and record the baseline and optimized revision identifiers.
2. Add an isolated demo Compose overlay and deterministic local embedding stub configuration.
3. Add a benchmark script with warm-up, repeated rounds, alternating order, and JSON output.
4. Add fixture reset and readiness checks for MongoDB and Qdrant.
5. Add a report generator that reads raw files without inventing missing values.
6. Execute Scenarios A–D, inspect invalid runs, and preserve accepted raw evidence.
7. Write a short runbook containing the 8–10 minute presentation sequence.

Optional phase 2, requiring separate approval, may add Micrometer counters and a Grafana dashboard. It is not required to establish the first before/after comparison.

## 10. Approval Gate

No benchmark harness, Compose overlay, application instrumentation, or source change will be created until a human approves this plan.

Approval phrase: `Approved recommendation indexing demo plan`.
