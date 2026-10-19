# Explore For You — Category Sections

`STATUS: IMPLEMENTING`

Approved reliability correction 2026-10-19 (user: “Tiến hành sửa”): optional category
Redis reads wait <=100ms, then fall back to Mongo; execute on a separate bounded pool
(4 workers/queue16), never category DB workers. A timed-out running read may finish
under the existing Redis I/O timeout to warm a cold connection; cancel queued work
without interrupting activation. Cache writes enqueue on a separate bounded pool
(2 workers/queue16), never block or discard ready canonical groups. Saturation skips
cache, not canonical retrieval. Keep category 1200ms/Recommendation 2s budgets and
validate with hanging-cache regression tests. No new API/provider/data migration.

### Cache isolation correction — verification and acceptance

- Implemented `CategoryCacheAccess`: the category caller waits at most the configured
  100ms read budget (including scheduling), then uses Mongo. Running optional I/O may
  finish under its driver timeout; queueing and workers are bounded. This is not a
  claim that Redis itself finishes within 100ms.
- Cache writes are best-effort asynchronous work, not part of returning a READY group.
  Rejected cache work is skipped; no caller-runs policy. Existing ordinary search and
  details cache behavior is unchanged.
- Logs distinguish `category_cache_put_enqueue_<category>` from actual background
  `category_cache_io_read`/`category_cache_io_write`; background work carries
  `category_cache_io_async=true` and may finish after the HTTP response. Do not add
  these asynchronous durations to foreground request time.
- Verification: 130 Place tests passed, including actual disposable Mongo queries
  and hanging-read/hanging-write/saturated-cache regressions. Context 57 and
  Recommendation 223 tests also passed: **410 total**, zero failures/errors/skips.
  Live-cloud semantic integration test explicitly excluded. An initial combined run
  hit a Context test-discovery ClassNotFoundException; a separate Context/Recommendation
  rerun passed. No production restart, cloud mutation, backfill or cache flush.
- Architecture/database/security/PR self-review: separate bounded executors avoid
  nested-pool starvation; no service ownership, schema, provider policy, API or auth
  changes; request context is restored in workers and cache failures remain optional.
- Runtime acceptance remains pending. For this correction restart **only Place and
  Context**, then run `bash scripts/start.sh`. Fully reload the browser once to clear
  the old in-memory preview, open For You and make two requests. Inspect
  `logs/place-service.log`, `logs/context-service.log` and correlated Recommendation
  logs: cache timeout must not by itself lose a successfully fetched Mongo group.
  Mongo/source failures can still produce partial results; no four-card guarantee
  for sparse eligible inventory and no end-to-end latency SLA is claimed.

Human approval: user explicitly requested implementation of revision 2 on 2026-10-19. Application code and automated verification are implemented; live inventory/latency and browser acceptance remain pending before production rollout.

- Date: 2026-10-19
- Revision: 2 — one shared preview pipeline, bounded batch retrieval, lazy category expansion; supersedes the initial four large category pools.
- Approved corrective follow-up (2026-10-19): user requested fixing the reproduced
  Homestay regex error and lost batches. Supersedes sequential Place execution below:
  Place-owned executor (8 workers, queue 16), one task/category, 1200ms batch wait
  including queueing. Keep completed groups, mark only failed/unfinished/rejected
  groups ERROR, cancel remaining work. Existing single HTTP batch and Recommendation
  2s retrieval budget remain. Remove Java-only inline regex `u` from Mongo queries;
  verify against actual MongoDB. No provider, schema or Context timeout changes.
- Owners: recommendation-service (feed/ranking), place-service (canonical places/category retrieval), web (presentation).
- Affected: `services/recommendation-service`, `services/place-service`, `apps/web/tripsense`; existing Gateway recommendation route.
- Related: [category discovery](./explore-category-discovery-and-pagination.md), [parallel hybrid retrieval](./explore-parallel-local-hybrid-retrieval.md), [local refresh policy](./explore-local-candidate-refresh-policy.md), [observed signals](./observed-history-signal-quality.md), [Context cache](./context-preferences-demand-cache.md).

## 1. Goal, scope and acceptance

Replace only the **blank submitted-query For You landing feed** with four vertically stacked sections, in this fixed order:

| Heading (VI / EN) | Code | Preview |
| --- | --- | --- |
| Điểm tham quan / Attractions | ATTRACTION | At most 4 places |
| Homestay / Homestays | HOMESTAY | At most 4 places |
| Ẩm thực / Food | FOOD | At most 4 places |
| Cà phê / Cafés | CAFE | At most 4 places |

The user explicitly confirmed **always at most four cards per section, including zoom-out**. This is an item-count rule, not “one responsive row”. Four sections contain at most 16 distinct places altogether.

### UX flow

1. Open For You without a submitted query: four headings, section skeletons, then real cards and a centered `Xem thêm / See more` button under each nonempty section.
2. Use the existing Mindtrip place card, details overlay, save, add-to-trip and map interactions. No unrelated navigation/map redesign.
3. Responsive grid uses available content-container width: one, two or four columns when cards fit. The split map pane may remain two columns. Zoom/resizing never increases card count or starts another request.
4. See more opens a single-category view within Explore, with its category heading and `Back to For You`. Reuse preview candidates and expand only that category to at most 48 matching ranked places, paginated 16 at a time. Existing FOOD/CAFE/ATTRACTION tabs use the same category expansion path for blank-query browsing. Homestay remains HOMESTAY, **not** the existing broad STAY filter. STAY retains its broad lodging meaning and must retrieve its own broader pool rather than treat cached homestays as complete lodging inventory.
5. Return restores the preview snapshot and scroll position in memory when still valid for the same user/destination. No localStorage of personal Context or recommendation profiles.
6. Entering a nonblank search keeps the current flat hybrid search/recommendation results and pagination. Clearing the submitted query returns to grouped For You. Autocomplete remains a separate existing flow.
7. Fewer than four valid places means fewer cards. Empty sections keep the heading and a compact localized empty message; no active See more button. A failed section shows an inline retry state, distinct from a genuinely empty category. Do not fill Homestay with hotels or invent camping inventory.
8. Map pins match the currently displayed cards: preview union (maximum 16), or the selected category page. Loading a different destination clears obsolete pins/results rather than flashing old data.

### Acceptance criteria

- [ ] AC1: Correct order; each preview length is 0–4 at 50%, 100%, 125% and 200% browser zoom and narrow/wide containers.
- [ ] AC2: Membership is enforced before candidate truncation, then revalidated before display. Hotel-heavy global top results cannot starve an independently retrievable category.
- [ ] AC3: Homestay requires explicit homestay evidence; generic hotel/lodging is insufficient. One canonical place appears in at most one preview section.
- [ ] AC4: Each section is ranked using the existing eligible Context/observed-intent policy; semantic retrieval remains a contributor, not removed by this UI change.
- [ ] AC5: Blank-query preview/See more makes no external place-provider calls, even when empty. Existing explicit-search provider policy is unchanged.
- [ ] AC6: See more, Back, map, details, save/add, feedback IDs/positions, EN/VI and keyboard navigation work without regressions.
- [ ] AC7: Partial failure does not erase successful sections; late/aborted responses never overwrite a newer query, destination, category or user session.
- [ ] AC8: Timings identify shared profile resolution, each retrieval source/category, ranking, impression persistence and cache operations. No claim of subsecond response without measurements.
- [ ] AC9: A cold preview resolves the user once, runs at most one semantic generation and one Place category-batch request. It does not call the full Explore recommendation service once per section or eagerly prepare four 48-item lists.
- [ ] AC10: Opening a category reuses a compatible seed, fetches only the selected category when needed, and never refreshes the other three. Direct category entry works without first opening For You; returning to For You reuses compatible in-memory preview data.
- [ ] AC11: Preview-to-category reuse preserves data provenance, authentication and current hard exclusions. A passive impression alone does not make all preview candidates unusable for expansion.

Out of scope: data ingestion/cleanup, camping-specific section, broad taxonomy overhaul, new ranking algorithm, observed-history redesign, new consent logic, Context client storage, provider background refresh, database access across services.

## 2. Architecture and deterministic retrieval

```text
Web -> Gateway -> Recommendation grouped-feed orchestration
                    |-- existing shared Context/history resolution (once)
                    |-- ONE Place batch call (4 small local category pools)
                    |-- ONE semantic source (parallel with Place)
                    '-- canonical validation -> category membership -> per-section
                        fusion/ranking -> dedupe -> top 4 -> one stored impression
```

No new microservice. Place alone reads its MongoDB; Recommendation alone reads/writes recommendation history. Context stays behind its existing service/cache contract. REST is needed for immediate results; no new Kafka event.

### 2.1 One pipeline is not one database query

Shared stages execute once per request: identity/destination resolution, Context/history, candidate orchestration, feature preparation, final impression transaction and response/cache write. A pure category loop partitions/fuses/ranks bounded subsets using the shared context; it must not recursively call `ExploreRecommendationService` for each category.

Two source operations run concurrently: one Place batch plus one semantic generation. The Place batch may perform four category-scoped Mongo queries; HTTP batching does **not** make their database work free. The approved corrective follow-up replaces sequential groups with a dedicated Place-owned bounded executor: 8 workers, queue 16, abort on saturation (never caller-runs), one task per requested category. A 1200ms wait budget includes queueing; preserve completed groups in request order and mark only failed/rejected/unfinished groups ERROR. Cancellation is best effort: driver operations still have their finite configured I/O timeouts. This executor is separate from Recommendation's retrieval executor; workers never submit nested work and wait on that same pool. A single Mongo aggregation with facets is not mandated.

### 2.2 Cold For You preview

1. Resolve identity, supported destination and shared Context/observed profile once. Read the compatible grouped-response cache; a hit avoids both candidate sources.
2. On a miss, run the two source operations above under the existing bounded retrieval executor. Place requests **12 candidates/category**, 48 total. Semantic requests at most 50 candidates once, using existing blank-query destination/personalization semantics, not fabricated category keyword searches. The initial transport pool is therefore at most 98 entries before deduplication, not 200 local + 50 semantic candidates.
3. Resolve semantic IDs through the existing canonical Place bulk contract; filter geo/category/negative/eligibility constraints. Share canonical snapshot resolution and feature computation by ID. Partition, fuse and rank each small subset with existing scoring rules.
4. Choose up to four unique IDs per section. Do not automatically increase pool size until it finds four; no retry/provider waterfall in the preview request. Fewer than four means the **bounded eligible pool** is insufficient, not proof that the database has no more matches.
5. Persist one recommendation with the at-most-16 returned items. Store a short-lived seed of remaining canonical IDs and compact source/evidence metadata for on-demand category expansion, not four fully prepared 48-item result lists.

Initial knobs: `preview-candidates-per-category=12` (validated 4–20), `semantic-limit=50` (existing source ceiling), `seed-ttl=5m`, `seed-max-ids=100`, `seed-max-bytes=65536`. Preview item count remains fixed at four regardless of these internal budgets. Serialize once per payload; an oversized/unavailable seed is skipped, with safe metadata `seedStored=false`, and must not fail the feed.

### 2.3 Category expansion / direct category entry

1. A tab or See more calls the grouped endpoint with one category and optional `seedId`. Backend validates ownership/destination/taxonomy/TTL; clients never submit cached candidates or scores.
2. An already-expanded compatible snapshot is reused. Otherwise resolve the current shared profile once for this new request, load canonical snapshots for available seed IDs and reapply current eligibility/explicit negative feedback. A seed is a retrieval optimization, not permission to serve an old personal profile.
3. Reuse semantic candidates from a compatible successful preview retrieval; **do not rerun semantic solely because a tab changed**. If no compatible successful semantic seed exists (direct entry, expired, or source previously failed), run semantic at most once for this selected category request, alongside its local fetch. Cached failure is not treated as successful empty output.
4. If the seed contains fewer than 48 eligible distinct candidates for the selected category, make at most one local Place batch request containing **only that category**, target 50. Merge seeded candidates and the bounded local supplement, then select at most 48. No fetch-until-full loop and no provider. A seed of 12 is useful reuse, but is not advertised as a full 48-item category cache hit.
5. On compatible continuation, retain still-eligible four preview cards first in their existing order, then rank the remainder; newly retrieved candidates do not unexpectedly push all familiar preview cards away. If Context revision/explicit intent/policy/filter compatibility changes, rerank normally and return `previewOrderPreserved=false`. Hard exclusions always take precedence. This intentional continuity trade-off lasts only for the short-lived seed.
6. Return/cache only this category snapshot, with its own recommendation ID and existing 16-item client pagination. Navigating between pages of that snapshot does not reretrieve/rerank. Existing backend served-snapshot versus client impression semantics remain unchanged; viewability analytics are not expanded in this feature.
7. Direct category entry follows the same one-category path without a seed. Going back restores a valid preview if available. Otherwise create the small grouped preview; reuse compatible source seeds from category navigation where present, but never infer other groups are complete from one category.

### 2.4 Membership, failure and budget rules

- For structured local retrieval, apply destination/geo/category eligibility **in the Mongo retrieval predicate before its bounded limit**, not after taking global text-search winners. Prefer existing geo/index capabilities; inspect explain plans before choosing an additional index. Cache keys include category and taxonomy version. Revalidate cached entries too.
- Place owns the category contract; response groups are category-constrained. Semantic snapshots are resolved through the existing canonical Place contract; absent or wrong-destination IDs cannot pass through. Category validation must match Place's strict classifier (shared fixtures/contract tests; no cross-service entity dependency).
- Category matching for this feed must use explicit normalized canonical category aliases. HOMESTAY additionally accepts an explicit normalized homestay word in a canonical name, but not an incidental description mention. General lodging/hotel, vague free-text descriptions and embedding similarity alone do not prove membership. Keep the existing broad STAY contract intact.
- Overlapping eligible categories get a deterministic preview owner: HOMESTAY, CAFE, FOOD, then ATTRACTION specificity priority. Display order remains ATTRACTION, HOMESTAY, FOOD, CAFE. Deduplicate by canonical ID **before** selecting four, so a fifth eligible candidate may fill a removed duplicate.
- Existing eligibility, exact negative feedback and evidence checks still apply. Rank inside each category; personalization cannot delete a section merely because another category has higher scores.
- Source fan-out is bounded: at most two concurrent source operations per grouped request (Place batch + semantic), no nested submissions waiting on the same executor. Canonical bulk resolution is a separate bounded dependency operation and must be included in the retrieval-phase deadline, not hidden as an unlimited call. Use bounded queues/HTTP and Mongo execution timeouts, propagate request ID, and cap total retrieval initially at 2 seconds (configurable; not an end-to-end SLA). Cancellation must bound the underlying HTTP/database operations too. Load-test/review pool settings before rollout.
- A semantic failure may still leave successful local sections usable. A category local failure may use valid semantic members with a degradation marker; no candidates plus a failed required source is ERROR, not EMPTY. All-source failure without a valid scoped fallback returns a safe 503.

| Scenario | Full user resolution | Semantic generation | Place category batch | Category DB queries (cold) |
| --- | --- | --- | --- | --- |
| Cold For You | 1 | at most 1 | 1 | at most 4, target 12 each |
| Fresh For You response-cache hit | at most 1, existing verification | 0 | 0 | 0 |
| Open café using preview seed, needs expansion | 1 | 0 if seed source is compatible/successful | at most 1, CAFE only | at most 1, target 50 |
| Existing expanded café snapshot reused | at most 1, existing verification | 0 | 0 | 0 |
| Direct café entry / expired seed | 1 | at most 1 | at most 1, CAFE only | at most 1, target 50 |
| Back to valid in-memory For You preview | 0 | 0 | 0 | 0 |

These counts exclude bounded canonical bulk lookup and Redis/context metadata checks; trace them separately rather than claiming zero work for every cache hit.

## 3. Additive contracts

### Public grouped feed

`POST /api/recommendations/explore-for-you/sections` through the existing Gateway route. Same authentication/session policy as existing Explore; no new anonymous personalization permissions. Authenticated identity is server-derived.

Request:

```json
{"destinationId":"danang","sessionId":"existing-session-id","section":null,"limit":4,"seedId":null}
```

- `destinationId`: existing supported destination allowlist; use server destination coordinates, not an arbitrary client identity/profile.
- `sessionId`: same validation as existing Explore.
- `section`: absent/null means all four previews and requires limit 4 (default); otherwise ATTRACTION, HOMESTAY, FOOD, CAFE or STAY and limit 1–48 (default 48). STAY is category-detail-only and never a fifth preview section.
- `seedId`: optional opaque UUID continuation hint. Wrong-owner hint => generic 404 without confirming existence. Missing/expired/incompatible owned seed => normal bounded retrieval with `seedReused=false`; do not fail ordinary navigation because a cache entry expired.
- No query field. Nonblank search continues using `/api/recommendations/explore-for-you` unchanged.

Response uses the existing success/data envelope. Data shape:

```typescript
type SectionCode = "ATTRACTION" | "HOMESTAY" | "FOOD" | "CAFE";
interface SectionFeed {
  recommendationId: string;
  seedId: string | null; // opaque server-owned continuation, not a user/profile ID
  expiresAt: string; // ISO-8601 freshness bound; not extended by every read
  seedReused: boolean;
  previewOrderPreserved: boolean;
  destinationId: string;
  resultMode: "PERSONALIZED" | "GENERIC_DESTINATION";
  personalization: { enabled: boolean; applied: boolean; signalCount: number };
  stale: boolean;
  requestedCount: number; // 16 for preview, requested limit for See more
  returnedCount: number; // actual flattened count, never inventory total
  sections: Array<{
    category: SectionCode | "STAY"; // STAY only for one-category view
    status: "READY" | "EMPTY" | "ERROR";
    degradations: string[]; // bounded safe codes only
    items: ExploreRecommendationItem[]; // existing public place/score/reasons/rank
  }>;
}
```

`rank` is the unique contiguous persisted global position in display-order flattening (1–16 preview; 1–48 See more), not a repeated 1–4 for each group. Preserve it unchanged for existing feedback events. Never claim a complete database category count from a bounded candidate pool. A nonempty preview can offer See more even if the expanded view ultimately has the same places.

Statuses: 200 usable feed (including true-empty and marked partial failure); existing 400 validation and auth errors; 503 total source failure/no safe fallback. Frontend retries the grouped request, not a cascade of four independent full recommendations.

### New internal Place batch endpoint

`POST /api/places/recommendations/categories` is additive; the existing `/api/places/recommendations` request/query behavior remains unchanged. Use the existing backend trust/access policy; do not expose a bypass around the Gateway/authentication rules.

```json
{
  "lat":16.0544,"lng":108.2022,"radiusMeters":15000,
  "categories":["ATTRACTION","HOMESTAY","FOOD","CAFE"],
  "targetPerCategory":12,"maximumAgeSeconds":2592000,
  "requiredFields":[],"allowExternalRefresh":false
}
```

Validation: 1–4 unique category codes from ATTRACTION/HOMESTAY/FOOD/CAFE/STAY, target 1–50 per group, geo/radius/requiredFields/max-age bounds from existing recommendation DTO. `allowExternalRefresh` must be false; true is rejected, and no provider code path is called. No arbitrary query to broaden categories. The Recommendation server constructs these values from trusted destination data; browser cannot request four 50-item groups through the preview API.

Response envelope contains `groups:[{category,status,places,evidence,degradations}]` with the existing Place DTO/evidence, status READY/EMPTY/ERROR. Each group failure is caught independently; no raw error text. Return all requested groups in deterministic order, with per-group cache keys/version and strict category guarantees. Unsupported category/duplicate request category => 400. Deploy Place before Recommendation uses the new endpoint.

No new feedback endpoint or Kafka topics.

## 4. Persistence, cache and lifecycle

- No new SQL table/column or cross-service relationship. Persist one existing recommendation impression with only final displayed items, in the current batch transaction; existing feature snapshots remain sufficient. See more creates its own recommendation ID; UI never mixes it with preview provenance.
- Preserve current authenticated ownership checks, cache-hit impression semantics and event idempotency. Do not persist four hidden 50-item candidate impressions. Passive impressions remain zero-affinity under observed-intent v2.
- Separate grouped cache namespace/policy version from the existing flat v3 cache. Key includes trusted user scope, destination, section/all, limit, profile/algorithm fingerprint and taxonomy/grouping version. Reuse existing response TTL and single-serialization/pipeline mechanisms, not four cache writes containing repeated full profiles.
- Seed namespace `rec:explore:sections:seed:v1:` stores one bounded envelope: trusted owner scope, opaque seed ID, destination/geo/filter scope, creation/expiry, Context revision if available, algorithm/taxonomy version, source success/degradation, up to 100 unique canonical IDs with compact source evidence, and the preview's four-ID order per category. Never store raw Context/history or image arrays. At most 64 KiB, TTL five minutes with no sliding refresh; create only for an actual navigation request. No population for all registered users.
- Expanded snapshots are created **on demand** per category, with distinct response keys; no four eager full lists. In-memory single-flight for the same scoped preview/expansion key limits duplicate concurrent work; bounded wait/queue, no new distributed lock infrastructure. Cross-node duplicate cache fills remain possible and harmless; preserve existing impression transaction/idempotency rules rather than promising exactly-once generation.
- Seed reuse does not require equality of the current full profile fingerprint: it includes seen IDs/time-decay values that can change immediately after an impression. For candidate reuse, require owner/destination/filter/TTL/taxonomy/algorithm compatibility, then revalidate current hard exclusions. For preserving preview order, also require compatible declared Context preferences and explicit intent; compare normalized declared preferences/active explicit states, excluding passive seen IDs and continuously decaying affinity floats. If these cannot be verified, reuse canonical IDs only and rerank, never blindly preserve stale rankings. Response cache compatibility remains the existing full fingerprint policy; this plan does not silently change global cache semantics.
- Last-known-good must have the same identity/destination/section/limit/policy compatibility. Do not cache a partial transport error as a successful complete feed; permit scoped valid existing fallback with stale/degradation metadata. Empty is cacheable only when retrieval succeeded.
- UI cache is bounded in-memory, scoped by user/destination/view and cleared on logout/user change. Returning to a still-valid preview is reuse, not new impressions on every render. Preserve existing event deduplication; viewability analytics redesign is out of scope.
- Inspect category query plans on representative inventory; add an owned Mongo index only if necessary and document exact migration/rollback before implementing that index. No unapproved data backfill or external writes.

## 5. Security and UI implementation constraints

- Public calls only through Gateway; retain downstream identity trust rules and recommendation ownership validation. Do not accept arbitrary user IDs, Context or ranking weights from the browser.
- Bound destination/session/category/limit inputs and retrieval queues; backend provider/Redis credentials never enter browser bundles or logs.
- Diagnostics log durations/counts/outcomes/codes, not Context contents, raw search/history payloads or credentials.
- Reuse `apiClient`, error sanitization, semantic theme tokens and existing cards/shared states. EN/VI schema parity; domain keys under `places`, shared actions under `common`.
- Extract a focused section component and feed hook instead of extending the monolithic discovery component with duplicate fetching/feedback logic. One explicit view state: grouped, category detail, or submitted search. Abort plus generation guard prevents stale commits.
- Accessible section headings, unique See more accessible names, keyboard focus on view changes, loading/empty/error announcements and adequate target sizes. No tab-switch/success toast; loading via skeleton, failures inline with retry.

## 6. Trade-offs / review synthesis

| Decision | Reason and cost |
| --- | --- |
| Category-constrained retrieval, not frontend grouping of global top 48 | Requires a small backend contract change; avoids hotel-heavy selection bias before grouping. |
| One aggregate feed request, shared user resolution | More server orchestration, but avoids four Context/history loads and fragmented impression ownership. |
| One Place batch with four small pools | Saves HTTP overhead, not necessarily DB work; at most four indexed queries still need measurement. |
| Lazy category expansion | Category click can require one additional fetch; avoids preparing 192 ranked results on every For You visit. |
| Preserve valid preview prefix during compatible expansion | Stable navigation at the cost of not promoting a newly retrieved candidate above that prefix until refresh; changes in explicit intent or Context trigger rerank. |
| Keep semantic + canonical local pools | Maintains current hybrid behavior; bounded extra local calls versus one global retrieval. |
| Strict Homestay, no hotel filler | Inventory may yield a sparse/empty section; honest labels are preferable to misclassification. |
| No provider for preview/See more | Predictable local discovery and existing provider policy; cannot solve missing inventory. |
| Fixed four cards, responsive columns | May occupy two/four rows on smaller content panes; matches explicitly confirmed maximum. |
| Whole-feed response, partial statuses | No streaming complexity; first display waits for bounded retrieval. Instrument and measure before introducing progressive streaming. |

Unified product, architecture, API, database, security and failure-mode review completed for planning. Approval of this plan authorizes the listed additive backend and UI work, not data import or a general redesign. No application code has been changed for this feature.

## 7. Implementation and verification after approval

1. Place: additive category-batch DTO/controller/service, strict HOMESTAY, category/geo-before-limit local queries, per-category cache isolation and independent safe outcomes. Existing search/recommendation contracts unchanged. Unit/contract tests including 1,500 hotel-biased fixtures and sparse categories.
2. Recommendation preview: shared Context/history once, two bounded source operations, compact seed, shared canonical/features, existing fusion/ranking, deduplication, grouped response cache and one final batch impression. Preserve flat search endpoint.
3. Recommendation expansion: scoped seed lookup/revalidation, single selected-category top-up, semantic reuse, compatible preview prefix, on-demand expanded snapshots and ownership-safe continuation. Add batch/seed-count/deadline diagnostics.
4. Web: API types/hook, reusable section view, existing blank-query tab integration, See more/back state, fixed item limits, map/feedback integration, localized honest states. Preserve nonblank search and broad STAY semantics.
5. Tests: preview 0/1/4/>4 inputs; ambiguous aliases/hotel descriptions; canonical missing IDs; duplicate groups; per-section errors/timeouts; same-executor starvation guard; cancellation; cache cross-user/destination/category isolation; feedback ownership/global positions; no provider calls; exactly one shared profile load; source-call count assertions from section 2.4. Add seed expiry/oversize/Redis outage, wrong-owner seed, same-key concurrent expansion, passive impression not breaking candidate reuse, explicit negative intent removing a preview place, STAY not incorrectly satisfied by HOMESTAY, successful-empty versus failed semantic seed, direct-entry and prefix continuity tests.
6. Browser checks: desktop split map, full-width and mobile, all zoom levels above; See more 16/page, Back restoration, search/clear, destination switch during pending load, save/add/details and EN/VI. Screen-reader/keyboard smoke checks.
7. Backend targeted suites for Place and Recommendation; exclude `SemanticCloudIntegrationTest` to avoid live cloud mutations. Use local mocks/fixtures for providers/semantic. Frontend: `npm run i18n:check`, `npm test`, `npm run lint`, `npm run type-check`, `npm run build`. Record pre-existing failures separately; scoped diff check only for this feature.
8. Trace cold/warm preview versus current flat feed and See more: Context/history once, per-source durations, total and timeout/partial counts. Batch verification to minimize service restarts; one restart of changed Place/Recommendation/Web after deployment, not repeated full-stack restarts.

### Diagnostic acceptance and hand-off

Add safe states `feed_view=preview|category`, `profile_load_count`, `semantic_call_count`, `place_batch_call_count`, `seed_reused`, `seed_ids_reused`, `category_topup`, per-category candidate/eligible/returned counts and per-group bounded-query durations. Reuse `requestId` and existing monitor/analyzer format, avoiding user-content/key-value logs.

Compare old blank-query flat feed against new cold/warm preview on identical controlled fixtures and current local inventory. Capture end-to-end p50/p95, source times, DB query counts and payload/cache bytes; then exercise preview -> CAFE -> page 2 -> For You. Require the exact work bounds above and no unintended provider call. A two-second retrieval cap is a safeguard, not a claim that the whole page is fast. Any measured latency regression needs a documented explanation/tuning or continued disabled rollout, not an unsupported performance claim. Production-load/eviction policy sizing remains an explicit deployment check, not inferred from single-user tests.

Rollout: additive Place contract first, then Recommendation endpoint, then web behind `NEXT_PUBLIC_EXPLORE_SECTION_FEED_ENABLED` (default false until verification). Disabled web keeps the current flat landing flow; rollback does not drop history/cache data or require a schema rollback.

## Human approval gate

`STATUS: IMPLEMENTING`

Revision 2 approved by the user on 2026-10-19. Implementation is authorized within this specification.

## 8. Implementation record and local acceptance

### Delivered

- Local acceptance typography follow-up (2026-10-19, explicitly requested by user): category headings use the existing `text-heading` role (18 px at the default root size) with `font-medium` (550), replacing 20 px / 700. Heading-to-card gap is 12 px and section gap 32 px at default scale. Scoped to grouped sections; no global typography or data-pipeline change. Added a heading-style regression test.

- Place: additive `/api/places/recommendations/categories`, strict category predicates combined with geo before the limit, 400 ms Mongo execution bound, bounded sequential groups with a 1.9-second soft batch budget, independent EMPTY/ERROR states, category-specific search cache and safe validation errors. No provider dependency or new index/migration. The soft batch budget stops additional groups; an already-blocked Redis/driver operation remains bounded by its configured I/O timeout, not forcibly interrupted at the exact budget instant.
- Recommendation: application-owned command/result and `CategoryCandidateSource` port (no application -> HTTP DTO/adapter dependency), two-source preview orchestration, shared features once, ranking inside groups, one final batch impression, scoped seed/response cache and lazy one-category expansion. Semantic port has a bounded-generation operation; real semantic adapter caps vector search at 50 for this feed. Complete eligible category seeds can skip both retrieval sources, while canonical hydration and hard exclusions still run.
- Seed: at most 100 source entries / 64 KiB / five minutes; canonical IDs/evidence, not raw Context/history/images. Cross-user lookup returns safe 404. Owner verification is stable across algorithm changes; destination/policy compatibility changes reject reuse normally. Corrupt/expired/oversized seeds fail soft. Affinity changes conservatively disable preview-prefix preservation, but do not unnecessarily discard the candidate seed merely because passive seen IDs changed.
- Response cache: internal typed result, separate HMAC-scoped fresh/LKG keys, one serialization/two pipelined writes, 256 KiB write/read bound. In-process single-flight waits at most the retrieval budget + 500 ms; it does not introduce distributed locks.
- Web: fixed four-item section rendering, same cards/actions/map, hook-owned bounded six-view memory cache, blank-query category tabs and See more share expansion, Back restores preview/scroll and feedback provenance, stale/aborted requests ignored, correct empty/error distinction, EN/VI.
- Diagnostics: Gateway/Recommendation/Place recognize new paths; per-category cache/DB phases and counts plus `feed_view`, `profile_load_count`, `semantic_call_count`, `place_batch_call_count`, `seed_reused`, `seed_ids_reused`, `category_topup`, `eligible_*`, `returned_*`, `retrieval_deadline_exceeded`. Existing monitor/analyzer accepts these bounded states.
- Local opt-in: gitignored `apps/web/tripsense/.env.local` enables `NEXT_PUBLIC_EXPLORE_SECTION_FEED_ENABLED=true` for the user's test. Checked-in `.env.example` remains false. This is not a production rollout or a service restart.

### Automated verification (2026-10-19)

- Gateway: 14 tests; Place: 115 tests; Recommendation: 217 tests, all passing (0 failures/errors/skips). `SemanticCloudIntegrationTest` explicitly excluded to avoid live cloud mutations. Includes architecture rules, shared taxonomy fixtures, hotel-heavy query fixtures, source work counts, ownership, seed reuse/expiry/corruption/size, pipeline cache serialization round-trip, timeout cancellation, negative intent and HTTP validation/authentication tests.
- Web: 354 tests / 73 files passing; includes grouped rendering cap, preview -> category -> Back reuse, feedback snapshot identity, scoped-cache isolation, aborted late responses and safe errors.
- TypeScript and i18n checks pass. Production build passes with the flag disabled and explicitly enabled. Lint exits successfully with zero errors; existing repository-wide warnings remain (309 in the recorded run). Earlier transient `use-active-chat.tsx` type errors were absent on the final checks; no edits to that unrelated file were made for this feature.
- Analyzer: 14 tests passing. Scoped whitespace/formatter checks recorded separately. No live provider/Qdrant/production Redis cleanup or data mutation, and no automatic restart of the user's services.

### Review summary

- Architecture: passed automated layer rules after moving transport mapping to API and adapting Place through a port. Existing service ownership/Gateway routing preserved; no new service, Kafka event or cross-service database access.
- Database: no schema/index mutation. Geo/category predicates precede bounded query limits; tests inspect the query shape. **Live Mongo explain/index presence is not verified**: no local Docker daemon was available. Inspect the existing 2dsphere index and actual query execution before production enablement; do not infer index presence from the annotation alone.
- Security: trusted authenticated identity for recommendation requests; opaque scoped seed ownership; strict enum/limit/session validation; provider=true prohibited in category batch; invalid DTO bodies return generic 400 rather than raw parse exceptions. Canonical public Place reads retain existing access policy, not a new privileged bypass.
- PR readiness: automated suites/build pass, existing search/provider policy untouched. Final production approval remains gated on real-inventory/visual/latency acceptance below, so status is deliberately not DONE.

### User test with `scripts/start.sh`

1. Local feature flag is already prepared in the gitignored web `.env.local`. Stop **only Place (8083), Recommendation (8088), Gateway (8080), Web (3000)** once with Ctrl+C in their existing terminals. Gateway restart is for correlation of the new endpoint; other services need not restart.
2. Run `bash scripts/start.sh` from the repository root. It starts stopped services and leaves the others alone. Already-running processes do not automatically load new Java code/environment, so merely running the script without stopping these processes is insufficient.
3. Sign in, open For You, verify headings ATTRACTION -> HOMESTAY -> FOOD -> CAFE, at most four each. Sparse inventory is honest, not replaced with hotels. Check desktop/mobile and browser zoom.
4. Open Café via See more or its tab, navigate page 2 if present, then return to For You. Expect the same preview while valid, no fourth independent pipeline, and one selected-category top-up only. Opening STAY must include broad lodging, not just the Homestay preview.
5. Search `cà phê chill` with Enter: expect the existing flat search pipeline, not grouped preview. Clear/submit blank to return. Change destination or switch categories rapidly to check stale-response guards.
6. Run `bash scripts/monitor-explore.sh`, or request-ID filtering with the actual `X-Request-ID` from the response. Cold preview should show profile_load_count=1, semantic_call_count<=1, place_batch_call_count=1. Category continuation normally shows seed_reused=true and semantic_call_count=0, with Place top-up only for that category. A same-view memory-cache return makes no new recommendation request, hence no new request log is expected.
7. Compare actual cold/warm timings and validate Mongo query plans before enabling production. Existing time-decaying profile fingerprint behavior is unchanged; frontend memory snapshot reuse is not a claim that every backend fresh-cache lookup will hit.

Rollback local UI: set `NEXT_PUBLIC_EXPLORE_SECTION_FEED_ENABLED=false` in the local web environment and restart Web. Production bundles need rebuilding with the desired build-time flag. No cache flush, table drop or data backfill is required.

### Corrective follow-up verification (2026-10-19)

- Fixed Place Homestay name regex to use Mongo-compatible `(?i)` rather than `(?iu)`.
  Java-only Recommendation matching remains unchanged; shared taxonomy contract passes.
- Replaced sequential Place groups with the dedicated bounded executor and partial
  batch collection described in the approved follow-up above. Queue saturation never
  runs Mongo on the HTTP caller. Preserve request order; cancel/purge unfinished work.
- Propagate safe request diagnostics to workers and restore ThreadLocal in finally.
  Workers check interruption after cache access before starting additional Mongo work.
- Regression coverage: slow first category preserves other three READY groups;
  failures stay distinct from genuine EMPTY; saturated executor returns safe ERRORs;
  Recommendation preserves three completed sections and one failed section with one
  source call each and one impression batch; existing semantic cancellation tests pass.
- Actual disposable localhost Mongo test executes the production query builder for
  Homestay/Food/Cafe, excludes ordinary hotels and name substrings, and removes only
  its own temporary fixture. No cloud DB/cache writes or credentials loaded by tests.
- Full verification: **119 Place + 218 Recommendation = 337 tests passed**, zero
  failures/errors/skips; includes architecture tests. Cloud semantic test excluded.
  Scoped Spotless and diff whitespace checks passed. Architecture/database/security/PR
  self-review found no blocking issue: no API/schema/auth/provider changes; concurrency
  and queue bounded; cancellation best effort within existing driver I/O timeouts.
- Integration opt-in: `-Dplace.category.integration=true`, requires `mongod` on PATH
  (or `-Dplace.category.mongod=/absolute/path/to/mongod`). No Docker required.
- Manual acceptance for **this corrective patch only**: restart only Place using its
  existing Terminal Ctrl+C then `bash scripts/start.sh`. Fully reload the browser to
  discard the old in-memory preview (not just Back to For You), request twice and
  inspect category status/counts. No cache flush or other service restart is needed.
  Runtime acceptance remains pending; no end-to-end SLA guarantee or permanent immunity
  to network/database outages is claimed. Context Redis timeout is a separate open issue.
