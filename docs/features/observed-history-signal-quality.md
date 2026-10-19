# Observed History Signal Quality — Specification & Implementation Plan

`STATUS: DONE`

Human approved implementation on 2026-10-19: “Implements”.

- Created: 2026-10-19.
- Owner/affected application: `services/recommendation-service`.
- Related: [Diagnostics and measured payload problem](./observed-history-diagnostics.md),
  [Context-owned personalization](./context-owned-personalization.md).
- User requested proceeding with the discussion's changes; this document supplies
  the concrete behavior and trade-offs for approval before application edits.

## 1. Goal, scope and acceptance

Stop treating automatic display events as positive preference, prevent repeated
actions from manufacturing strong affinity, and keep single-place rejection from
becoming a rejection of every place in its category. Separately reduce the large
snapshot payload (measured 3.05 MB versus categories 65 KB).

In scope: owner-side history reader and deterministic profile calculation,
preference feature integration, safe cache/version separation, tests and existing
bounded diagnostics. No new cache, schema, service, events or frontend work.

Out of scope: viewport tracking, dwell-time collection, place attributes/image
analysis, new-place exploration slots, tuning retrieval/provider/limits, ranking
weight redesign, changing Context/User data or removing stored history.

Acceptance:

- AC1: categories-only projection preserves old results under legacy policy.
- AC2: repeated IMPRESSION without intentional action yields zero observed
  category affinity, no negative opinion and no learned-preference claim.
- AC3: repeated click/detail/save events on one place cannot inflate affinity
  without bound or manufacture evidence from many independent places.
- AC4: UNSAVE/REMOVE_FROM_TRIP revoke their matching positive state rather than
  emit negative category evidence; DISLIKE/LIKE concern the exact place only.
- AC5: sparse evidence has smaller downstream preference influence; confidence
  is not canceled by normalization in feature extraction.
- AC6: onboarding preferences, owner/auth validation, raw event audit, impression
  recording and existing safe failure fallback remain intact.

## 2. Architecture and deterministic behavior

Existing flow stays Web -> Gateway -> Recommendation -> its own DB. Context
declared preferences continue over the existing purpose-filtered HTTP API.
No cross-service SQL/JPA or direct consumer Redis access.

### Phase A: independent performance improvement

Replace full item.feature_snapshot with
`item.feature_snapshot->'place'->'categories' AS categories_snapshot` in affinity
loading. Keep event fields, user predicate, join and history limit. Adapt JSON
reader to the projected node with identical handling of missing/null/non-array
values. Preserve existing normalization/coercion in legacy policy; no taxonomy
change or rating/retrieval modifications. Keep diagnostic phase names.

### Phase B: observed policy v2 (intent, not exposure)

Keep raw events as-is; reinterpret them when deriving profiles. No data rewrite.

| Signal | Proposed derived meaning |
| --- | --- |
| IMPRESSION | Exposure/seen only; affinity contribution zero |
| CLICK, BOOKING_CLICK | Weak intentional interest, base weight 0.30 |
| DETAIL_VIEW | Interest, base weight 0.40 |
| SAVE | Positive only while latest SAVE/UNSAVE state is saved; base 1.00 |
| ADD_TO_TRIP | Positive only while latest ADD/REMOVE state is added; base 1.50 |
| UNSAVE, REMOVE_FROM_TRIP | Revoke corresponding positive state; no negative affinity |
| DISLIKE | Keep exact place in negativePlaceIds; no negative category propagation |
| LIKE | Clear exact-place dislike as currently; explicit positive interest base 0.80 |

Preserve seen/saved/added/negative sets and the existing exact-place negative
ranking penalty. Dislike is not a new hard filter. In v2, current exact-place
dislike suppresses its positive affinity contribution until cleared by LIKE.
Save/click does not silently clear dislike. Existing declared category exclusions
are unaffected. API support for LIKE/DISLIKE is not evidence the current UI emits
them; no new UI is introduced.

Aggregate events chronologically with stable tie-breaking by occurred_at then
event_id. Keep the bounded last-N semantics (default 5000); document that state
older than this window is not an authoritative lifetime save/trip state.
Use global latest state to gate active SAVE/ADD/DISLIKE, including when a revoke
occurred in another session/trip; don't resurrect stale segment-local state.

For each long-term/trip/session segment, retain at most one positive evidence
item per place: the strongest applicable decayed intentional signal. Preserve
existing exponential age decay (lambda 0.01/day). Reopening a place can refresh
recency but cannot accumulate arbitrary points. Do not stack click + detail +
save on the same place. Deduplicate category strings and distribute its evidence
over its valid categories so a many-tagged place does not multiply its total
vote. Missing categories do not produce learned affinities/evidence mass.

Confidence: for each segment let E be the sum across distinct eligible places of
min(1, retained decayed signal strength). Proposed initial formula:

```text
confidence = min(observedMaxInfluence, E / (E + confidencePrior))
confidencePrior = 3.0
observedMaxInfluence = 0.50
segment affinity = normalized positive category strengths * confidence
```

These are conservative initial engineering defaults, not empirically optimal
parameters. Validate finite positive prior and influence in [0,1]. Retain segment
mixture 50/30/20 over available segments; no additional normalization back to 1
after confidence shrinkage. Only intentional valid-category evidence makes a
segment available. One click in all three overlapping segments remains weak:
the weighted average must not amplify identical evidence across segments.

Merge declared Context signals by the existing rule. Fix PreferenceFeatureExtractor
to recognize finite nonzero affinity-only profiles (currently availability depends
on declared preferred/disliked sets), and use matchedPositiveAffinity /
max(1, totalAbsoluteAffinity) when affinities exist. This prevents sparse affinity
scaling from being canceled by division by a small total. Preserve current
fallback for explicit preferences with no affinity. Test declared + observed
combinations, rather than assuming the cap is an exact percentage of final rank.

### Result/cache compatibility and rollback

Introduce an owner-side policy flag, proposed
`RECOMMENDATION_OBSERVED_SIGNAL_POLICY_V2_ENABLED=true` after approval, with false
selecting the legacy derivation on the new lightweight projection. Keep the
existing observed-history enable flag separate. Include policy version in result
cache key/fingerprint and bump namespace to avoid old scores/reasons being served
under new behavior; no global Redis flush. Update exposed algorithm versions
where feature/profile semantics changed. Toggle rollback requires only restarting
Recommendation; no DB migration or data restoration. Document that returning to
legacy re-enables old impression/negative-category behavior.

## 3. API and event contracts

Existing POST `/api/recommendations/{recommendationId}/events`, feedback DTO,
Bearer ownership and Idempotency-Key contract unchanged. Explore response shape
unchanged; personalisation applied/counts must not treat passive seen-only data
as active learned preference under v2. Audit/seen counts remain available under
separate existing/internal diagnostic fields. Algorithm version values may change.
No Kafka topics, outbox payload changes, background consumer or endpoint additions.

## 4. Persistence and data ownership

Recommendation-only reads from existing impression/item/feedback tables. No new
table/index/migration or destructive cleanup. event_id is already a UUID primary
key; add it to bounded feedback order for deterministic ties in Phase B, separate
from the behavior-preserving Phase A. Prefer one shared bounded event snapshot
for derived state/affinity where practical without adding queries or transactions;
if separate existing reads remain, don't claim cross-query snapshot consistency.
No full snapshot download for affinity and no unbounded scan to fix truncated history.

## 5. Security and trust boundaries

Owner from authenticated principal, not client-supplied user ID. Keep item/position,
timestamp, idempotency validation. Signals remain untrusted client reports; bounded
dedup is not anti-fraud or proof of a genuine visit/save. No logs of place/user IDs,
raw JSON, queries, URLs/tokens or preferences; fixed phase names and aggregate counts
only. No new personal data or browser storage. No live user/Redis/LLM mutations in tests.

## 6. Trade-offs and decisions

- Less passive evidence => slower personalization, less self-reinforcing exposure bias.
- One-place cap and confidence => repeat visits express recency rather than unlimited
  intensity; fewer distinct places means weaker learning, intentionally.
- No inferred negative categories => weaker dislike generalization, fewer false exclusions.
- Revokes remove a positive state, but earlier genuine click evidence can remain.
- Categories remain coarse; no claim to distinguish café ambience without suitable data.
- Same-category candidates may still have identical preference scores. Search intent,
  quality, distance and diversity retain current roles; new-place exposure isn't solved here.
- Removing positive impression affinity means seen-only profile is no longer learned
  preference, but seen sets may still change cache fingerprints. Cache cadence redesign deferred.
- Do not promise measured endpoint speedups from psql samples; rerun existing traces.

## 7. Implementation tasks and verification

- [x] Phase A projection and regression fixtures: null/missing/non-array/mixed JSON
      category values, Unicode/case normalization, empty events, unchanged legacy outputs.
- [x] Phase B pure testable reducer/segment confidence; configurable validated bounds
      and injected/fixed clock in tests; keep adapter/orchestration responsibilities clear.
- [x] Tests: 10 exposures vs one click; 100 duplicate clicks vs one; click+detail+save
      not stacked; distinct-place evidence vs repetitions; decay; multiple category tags;
      cross-session revokes; save/unsave/save; remove/add; dislike doesn't penalize unrelated
      café; LIKE clears dislike; deterministic ties; no-category/empty/5000-event boundary.
- [x] Feature/rank tests prove sparse confidence survives normalization, affinity-only
      activation, unchanged explicit request exclusions, Context unavailable/empty merge,
      no query-mode HISTORY boost introduced and passive-only response metadata correct.
- [x] Version/cache tests: legacy/v2 isolation, flag false behavior, old cache not reused.
- [x] Preserve diagnostics and add only bounded signal/evidence aggregates if useful.
- [x] Run offline Recommendation tests (exclude SemanticCloudIntegrationTest), script
      tests if touched, scoped Spotless and git diff --check. Architecture/DB/security/PR
      self-reviews; no cloud provider writes or user history deletion.
- [x] Record manual handoff: one Recommendation restart, compare existing request
      timings/results, no repeated all-service restarts. Do not claim quality improvement
      from unit tests alone; exact ranking changes are intentional and need user review.

## 8. Implementation report (2026-10-19)

Implemented after explicit approval; local/live acceptance is a handoff step, not
a claimed measured performance or recommendation-quality improvement.

### Delivered

- Both legacy and intent policies read only categories JSON for affinity; full
  snapshots are still stored by impression recording, not deleted or migrated.
- V2 uses two bounded reads: existing shown-place query and one ordered joined
  event/categories query. Event state and affinities use the same event list;
  no separate observed_feedback_query in v2, no extra transaction/probe connection.
  Legacy flag retains the original three-query derivation on projected categories.
- New pure ObservedSignalReducer accepts explicit evaluation Instant for fixed-clock
  tests, stable event ordering, globally gated SAVE/ADD/DISLIKE, one strongest
  decayed intent per place per segment, shared category vote and confidence.
- Normalization is explicitly L1 (divide by total positive category strength), so
  total observed affinity mass is bounded by confidence even for many-tagged places.
  Preserve 50/30/20 segment composition; no claim of a 50% final-ranking cap.
- PreferenceFeatureExtractor activates affinity-only profiles and preserves sparse
  magnitude with max(1,total) denominator; legacy flag restores old availability
  and ratio behavior. Original rank weights/query criteria and hard filters unchanged.
- Passive seen IDs remain available for audit/fingerprint, but Explore v2 signal
  count/applied/resultMode no longer claim they are learned preferences. Active
  saved/added/negative states remain effective signals, including with no categories.
- Cache namespace rec:explore:v3; full profile policy/settings fingerprint separates
  modes and tuning values for fresh and LKG. No Redis flush. Exposed feature version
  suffix is observed-intent-v2 or observed-legacy-v1.
- Added validated config and three corresponding Compose passthrough variables;
  no infrastructure topology or unrelated Compose settings changed in this feature.

### Verification and reviews

- **200 Recommendation tests passed**, 0 failures/errors/skipped, excluding only
  SemanticCloudIntegrationTest by name to prevent cloud mutations.
- **12 analyzer tests passed**; no analyzer change required for this policy.
- 31 additional cases over the previous 169-test suite: deterministic reducer,
  5000-event fixture, projected JSON legacy coercion, mock-JDBC SQL/limit/connection
  lifecycle, rollback semantics, downstream actual feature/ranker integration,
  passive-only Explore metadata, config Bean Validation and algorithm/cache isolation.
- Scoped Spotless, Compose config --no-interpolate --quiet, git diff --check passed.
- Architecture/DB/security/PR self-reviews: no blocking findings. No public API or
  schema changes, no cross-service storage, raw events and idempotency validation
  untouched, no per-row/private-value diagnostics or live data mutations.
- Tests use in-memory fixtures/mocked JDBC and real feature/ranker components;
  they are not live PostgreSQL load tests or a quality experiment with real users.

### Configuration, local test and rollback

Defaults (no local env edits made):

```text
RECOMMENDATION_OBSERVED_SIGNAL_POLICY_V2_ENABLED=true
RECOMMENDATION_OBSERVED_CONFIDENCE_PRIOR=3.0
RECOMMENDATION_OBSERVED_MAX_INFLUENCE=0.50
```

Stop only Recommendation with Ctrl+C, then run bash scripts/start.sh from repo
root. Other listening services are skipped. Use For You/search twice; inspect
observed_signal_policy=intent_v2, observed_affinity_query, observed_profile_compose,
row/decode counts and overall request duration. The legacy feedback query phase
is intentionally absent under v2. Existing history is reinterpreted; user need not
delete/reset data. Do not infer passive-only behavior on a real account that
already has click/save/Context preferences.

Rollback by setting RECOMMENDATION_OBSERVED_SIGNAL_POLICY_V2_ENABLED=false and
restarting only Recommendation. The efficient categories projection remains;
old exposure/negative-category logic returns. This mode has its own v3 cache keys.
Do not use flushall/flushdb or erase user history.

Known limitations: coarse categories, last-5000 state window, no viewability or
new-place exploration. Raw impression events are still recorded. Profile content
fingerprints can change with seen IDs and time-decayed confidence even without a
new intentional action; cache-hit cadence/quantization is explicitly deferred.
This correctness-first implementation makes no cache-hit-rate guarantee.

Exact offline test command:

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
```
