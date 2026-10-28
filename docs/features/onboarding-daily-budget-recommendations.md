# Onboarding daily budget and sourced price recommendations

`STATUS: DONE`

Human approved implementation on 2026-10-28: "approve".

- Date: 2026-10-28.
- Owners: Context owns declared budget; Place owns price evidence; Recommendation owns ranking.
- Affected components: Web, Context, Place, Recommendation; existing Gateway routes.
- User decisions (revised): VND per person per day; required amount within the existing budget-tier step; keep 10 steps and reuse the existing input. Use sourced prices only, leaving candidates without comparable prices on existing ranking. This supersedes the earlier optional extra-step proposal.

## 1. Goal, flow and acceptance

Keep the existing step 6 budget screen and the 10-step onboarding flow. Retain the tier choices and reuse the input for the required numeric amount. User follow-up on 2026-10-28 moves the money input immediately below the question/subtitle and before the tier choices, with placeholder "Nhập số tiền mỗi người/ngày, ví dụ: 700.000" and the VNĐ suffix. Do not add a screen, step, modal or skip action. Subsequent step order and progress calculations remain unchanged.

- Keep the layout, image and navigation. On 2026-10-28 the user requested clearer wording: title "Bạn dự định chi bao nhiêu cho một người mỗi ngày?", subtitle explicitly asks for the amount, visible/accessible label "Ngân sách (VNĐ/người/ngày)", placeholder "Ví dụ: 700.000", and a visible VNĐ suffix within the input. Other preference steps retain their current custom-choice input behavior.
- Numeric input accepts whole VND, from 1 to 1,000,000,000 inclusive. Display localized grouping while storing unformatted digits. Empty, negative, decimal, exponent, nonnumeric and out-of-range values are invalid; show translated inline errors on interaction. No default amount or automatic tier conversion.
- Keyboard correction and follow-up on 2026-10-28: show thousands grouping during normal typing (500000 -> 500.000) while restoring the caret by its logical digit position. Preserve the exact DOM text during Vietnamese IME composition and format after composition commits. Backspace/Delete over a grouping mark removes the adjacent digit rather than trapping the caret. Correctly grouped pasted VND amounts are normalized; explicit decimal paste remains invalid. The API still receives unformatted whole-VND digits.
- Persistent Vietnamese IME follow-up: while the native composition remains open, render a grouped presentation in the same input box and mirror the logical caret/selection there. The native input keeps its exact composition buffer, with transparent text only while that grouped presentation is active. Native input and presentation converge on composition commit. This makes 70000 visibly read as 70.000 before commit, without rewriting the IME buffer. The presentation is hidden from assistive technology; the labeled native input remains accessible.
- At this step, input writes directly to the budget draft; hide the generic "+ Thêm" custom-choice button for this step only. Do not create a numeric BUDGET_TIER option or require a separate add/confirm click. Enable "Tiếp tục" only after both a tier and a valid amount are present. Back/Next retains the draft. Preserve all unrelated answers when saving. Reuse existing final batch-save and optimistic version handling; no new per-step network requests.
- Existing completed users without an amount can continue using the app. Do not reset completed onboarding. Draft profiles must supply the amount before first completion. Existing personalization editors must preserve the new dimension even if they do not yet render an editor for it.
- Supported price evidence above the daily amount lowers a candidate's ranking score. Missing, stale or incompatible price evidence does not change that candidate's score. Do not hard-filter expensive candidates or treat unknown prices as free.
- No itinerary-level cost optimization or promise that a full day fits the budget. A per-visit price below the daily budget alone cannot prove this.

## 2. Current source findings and architecture

The wizard currently has hardcoded preference indices 4–8 and free text at 9. Keep these indices, total steps and final-save location unchanged. Apply numeric input and validation as a budget-step-specific branch; avoid unrelated step-definition refactoring.

Context already stores single-value selections, publishes ONBOARDING preference signals, and exposes purpose-scoped cached snapshots. Recommendation reads these signals but currently maps category affinities only; neither its PlaceSnapshot nor PlaceDto contains monetary price evidence. Place currently reports price fields as unavailable. Therefore a UI-only change would not affect ranking.

Flow: Web -> Gateway -> Context onboarding APIs -> Context preference signals/cache -> existing Recommendation Context HTTP read. Place snapshots carry optional sourced price evidence to Recommendation. No cross-service SQL, new microservice, new broker topic or direct browser calls to service ports.

## 3. Contracts and persistence

### Budget in existing Context contracts

Reuse authenticated GET/PUT `/api/context/onboarding` and POST `/api/context/onboarding/complete`. Add a standard SINGLE catalog dimension `DAILY_BUDGET_VND`. Example addition to the existing PUT body:

```json
{
  "version": 3,
  "selections": {
    "BUDGET_TIER": ["MID_RANGE"],
    "DAILY_BUDGET_VND": ["700000"]
  },
  "places": {}
}
```

This is an abbreviated example: clients must retain other answers. Do not send an empty selection list or zero. Context validates cardinality and canonical positive decimal digits plus the above range, using integer arithmetic. IN_PROGRESS draft saves may omit the dimension, but the first completion must require a valid amount and selected tier, returning 400 without marking the profile completed if either is missing. Preserve idempotent completion for already-COMPLETED legacy profiles without a budget, and allow legacy settings updates that do not introduce an invalid numeric value. Reject removal of an existing numeric amount from a completed profile. Reject malformed values with the existing 400 envelope; preserve existing 401/403 and version-conflict behavior.

GET and `/api/context/preferences?purpose=EXPLORE_RECOMMENDATION` return the value using existing signal shapes, `source=ONBOARDING`, confidence 1.0. Existing TRIP_PLANNING purpose may return the standard signal; AI consumption is outside this increment. Do not encode money in free text or category affinities.

Add `V2__add_daily_budget_dimension.sql` (V1 is currently the only migration): insert the active STANDARD/SINGLE dimension idempotently. Reuse onboarding_selections/preference_signals, existing versioned cache keys and profile-change outbox behavior. No new monetary column or cross-service relationship. No backfill of invented budgets. Rolling back code can leave the additive catalog row in place; existing consumers ignore unsupported dimensions.

### Sourced Place evidence and maintenance

Add an optional embedded `priceEvidence` to Place Mongo documents, PlaceDto and all candidate/snapshot mapping paths. Contract:

```json
{
  "amountVnd": 120000,
  "basis": "PER_PERSON_VISIT",
  "sourceUrl": "https://example.org/official-ticket-prices",
  "observedAt": "2026-10-28T00:00:00Z"
}
```

The URL above is illustrative, not real price data. Supported bases: `PER_PERSON_VISIT` and `PER_PERSON_NIGHT`. Amount is a nonnegative whole VND integer up to 1,000,000,000; zero requires an explicit sourced free-entry statement. Use only a documented standard adult price, or a documented per-person nightly rate; do not convert room, group, membership, discounted, child or foreign-currency prices into per-person VND. Unknown values stay null. Currency and basis are fixed by this contract; never infer them from a place name, review, category, LLM or a dollar-sign price level.

Implement ADMIN-only PUT and DELETE `/api/places/admin/{placeId}/price-evidence`, through existing Gateway routing and Place JWT security. PUT replaces just this field atomically and returns the saved evidence in the existing API envelope (200); DELETE unsets just this field (204). Invalid evidence is 400, unknown canonical place 404, unauthorized caller 401/403. Source URL must be HTTPS, at most 2048 characters, with no userinfo; observedAt must not be in the future. Store server audit timestamp and editor identity separately from public evidence. Do not fetch the supplied URL in the request handler. No admin UI or scraping system in this increment.

Document an operator example using these endpoints to add a verified price from a venue's official published tariff. Preserve curated evidence during provider refresh, patch unrelated fields only, and invalidate affected Place cache entries after edits. No bulk production backfill or invented runtime seed records. Test fixtures may use explicitly synthetic prices; they must never be presented as verified live venue data. A live ranking effect requires actual verified entries to be supplied through this maintenance path.

Update Place evidence-availability reporting for price fields only when valid supported evidence is present. Price evidence is usable for 30 days from observedAt; missing, invalid, future or older values remain unavailable. Apply expiration at ranking time even when a cached snapshot contains an older field. Mongo changes are additive; existing records need no migration/index/backfill.

## 4. Recommendation behavior, compatibility and failure handling

- Parse `DAILY_BUDGET_VND` separately from category signals in RemoteRecommendationContextProvider. Add nullable `dailyBudgetVnd` and `budgetTier` to the declared profile snapshot, preserving old constructor defaults. Reject malformed/out-of-range downstream amounts defensively; no exception should disable unrelated valid preferences.
- Numeric amount takes precedence for this adjustment. When absent, retain existing ranking and tier choice; current code has no monetary tier scoring, so do not claim that fallback already compares prices or invent numeric thresholds for tiers.
- Represent availability, sourced amount/basis and budget adjustment explicitly in candidate evidence. For a valid budget B and comparable sourced amount P: if P <= B, adjustment is 0; if P > B, adjustment is `-0.15 * (1 - B/P)`. Use safe division. Missing budget/evidence yields adjustment 0. Apply once to the existing final heuristic score, clamp to [0,1], then sort with existing tie-breakers. The coefficient is a configurable maximum penalty, default 0.15; setting it to zero disables this adjustment. Do not add artificial positive scores for unknown or cheap candidates.
- Per-person visit/night prices are a conservative upper-bound comparison against one daily budget. Do not split the daily amount into arbitrary meal/hotel percentages, sum independent suggestions, or reinterpret it as a per-item allowance. Explain only the sourced fact that an item itself exceeds the daily budget; do not label all cheaper items as a guaranteed affordable day.
- Add optional budget adjustment/evidence fields to ScoreBreakdown and response DTOs, retaining old constructors/defaults. Add typed `DAILY_BUDGET_EXCEEDED` reason only for nonzero penalty, with public sourced amount/basis and URL; translate Web rendering and avoid raw numeric budget in logs. Do not change recommendation request schema or move scoring into Place.
- Include canonical budget/tier in all profile fingerprints and seed/cache scopes used by Explore and grouped sections, including last-known-good fallbacks; bump ranking algorithm/cache version. Keep existing Context revision isolation. Old result caches must not mask changed budgets. Price edits invalidate Place snapshots; existing fresh recommendation cache TTL is 10 minutes and last-known-good TTL is 24 hours. Keep these TTLs, document that edited prices can remain in cached results within those bounds, and bypass any cached response whose used price evidence has crossed the 30-day expiry (including stale fallback). Do not promise immediate cross-service invalidation.
- Context failure preserves existing category/history fallback and disables only unavailable budget data. Price maintenance does not cause recommendation requests to call external tariff pages. Honor existing scope/radius/category filters and fallback ordering.
- AI tools that consume additive explanation DTOs must continue parsing them and must not reorder results or claim a full itinerary fits a budget. New AI budget-intake or trip budget rules are outside scope.

## 5. Security, tasks and verification

Budget reads/writes use the authenticated user's existing Context identity; never accept another user's ID as authority. Existing optimistic locking prevents stale overwrites. Price writes require verified ADMIN authority; do not expose write endpoints publicly. All Web API calls use apiClient and sanitized errors. Add English/Vietnamese keys in the existing onboarding and recommendation translation namespaces with full key parity. Do not log budget values or expose internal exception text.

Implementation order:

1. Context catalog migration, amount validation and first-completion requirement with legacy compatibility; API round-trip, publisher and cache regression tests.
2. Place nullable price model, snapshot propagation, preservation on refresh, ADMIN maintenance and invalidation; authorization and evidence-validation tests.
3. Recommendation profile mapping, bounded adjustment, sourced explanations and cache scopes; compatibility for existing constructors and consumers.
4. Reuse the budget step's existing input for required localized amount entry, gate Next, preserve back behavior and add explanation rendering; preserve generic personalization editor round-trips.
5. Run checks, rebuild affected Docker services, then manual onboarding and recommendation smoke checks. Retain database volumes and existing env files.

Required scenarios:

- Budget remains step 6 of 10; no additional step or skip action. Existing tier choices and layout remain. Entering, going back, editing, save/reload and completion retain expected answers; generic custom-choice behavior on other steps remains unchanged.
- Boundary amounts accepted; empty, malformed, fractional, zero, negative and overflowing budget block Next. Draft saves can omit the amount, but first completion cannot. Backend bypass of UI validation is rejected; selected tier alone cannot complete new onboarding.
- Existing completed profiles without this dimension work unchanged. Draft clients must supply the dimension for first completion. Version conflicts remain visible and cannot silently overwrite answers. Settings save preserves the dimension.
- Budget 700000 with otherwise equal candidates priced 100000 and 1000000 produces unchanged baseline for the first and a negative adjustment for the second. Changing/clearing the budget changes fingerprints and the corresponding result.
- Unknown/stale/wrong-basis/future price remains unavailable and has exactly zero score adjustment. Free evidence is not fabricated. P=B has zero adjustment; extreme ratios remain bounded. Other ranking criteria and tie-breakers are preserved.
- Non-admin writes fail; unknown place fails; refresh preserves curated evidence; deleting evidence stops adjustment after cache refresh. Source URLs are stored/rendered safely, never server-fetched by the endpoint.
- All-price-missing inventory explicitly reports no budget evidence rather than claiming optimization. Live acceptance uses an operator-verified tariff entry; synthetic fixtures alone do not establish live price coverage.

Commands: root Maven wrapper with `-pl services/context-service,services/place-service,services/recommendation-service -am test`; Web `npm.cmd run i18n:check`, `npm.cmd run type-check`, targeted Vitest onboarding/explore tests and ESLint for touched files. Use existing wrapper available in context-service with `-f ../../pom.xml` when root has no wrapper. Run Docker Compose config validation and affected-service rebuild only after implementation approval. Manual acceptance uses local data and no production writes.

## Human approval gate

Implementation authorized by the user on 2026-10-28, including the revised required input in the existing budget step.

`STATUS: DONE`

## Operator notes

After verifying a venue's published standard adult per-person tariff, an authenticated ADMIN can update its canonical place. The command below uses variables supplied by the operator; it does not scrape or infer prices.

```powershell
$headers = @{ Authorization = "Bearer $adminAccessToken" }
$price = @{
  amountVnd = $verifiedWholeVndAmount
  basis = "PER_PERSON_VISIT"
  sourceUrl = $officialTariffUrl
  observedAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri "http://localhost:8080/api/places/admin/$canonicalPlaceId/price-evidence" -Headers $headers -ContentType "application/json" -Body $price
```

Use `PER_PERSON_NIGHT` only for a genuinely per-person published nightly rate. Set zero only when the cited source explicitly states standard adult admission is free. To remove an outdated entry, send DELETE to the same URL. Updating/removing price evidence never changes other place fields.

The budget adjustment can be disabled with `RECOMMENDATION_BUDGET_MAXIMUM_PENALTY=0` in the backend environment followed by recreation of recommendation-service. Default is 0.15. Fresh recommendation results can retain an edited price for the normal 10-minute TTL; degraded last-known-good results for up to 24 hours, bounded by the evidence's 30-day expiry. No verified live tariffs are prepopulated by this feature.

## Completion and verification — 2026-10-28

- Implemented the required amount in the existing sixth step; retained the ten-step flow and existing layout. Added English/Vietnamese validation and sourced-price text in the existing card price row.
- Implemented Context migration/validation, legacy completion compatibility, price maintenance with ADMIN authorization, atomic preservation of curated prices during provider refresh, budget ranking/explanations and budget-sensitive cache/seed scopes.
- Java 21 Docker test run: Place 134 cases (1 skipped), Context 59 (7 skipped), Recommendation 238 (1 skipped). Total 422 passed, 9 opt-in/environment-dependent cases skipped, no failures/errors. Existing opt-in PostgreSQL cache fixtures now explicitly construct persisted legacy-completed profiles.
- Web: 28 targeted tests passed across onboarding, personalization settings and Explore cards/feed; TypeScript and sorted bilingual i18n schema checks passed. Touched-file ESLint has no errors; two pre-existing wizard hook warnings remain.
- Architecture, database, security and PR checklist reviews: no blocking findings. Ownership and JWT security remain within existing services; migration is additive and no production data was accessed.
- Rebuilt/recreated only Context, Place and Recommendation in local Docker. Flyway applied V2 successfully; all three services and Gateway returned health UP. Frontend `/onboarding` returned HTTP 200.
- Local Gateway smoke check verified missing/fractional/zero/out-of-range amount rejection, successful save/completion, the published `DAILY_BUDGET_VND` preference, protection against clearing a completed budget, non-admin price-write rejection, admin missing-place 404, and fractional-price rejection. Temporary onboarding profiles were removed after testing. Existing servlet error dispatch can render a non-admin rejection as 401 rather than 403; both reject the write, while the security-chain unit test verifies the ADMIN matcher.
- Operator acceptance against a real venue tariff remains a data-coverage handoff: no live tariffs were invented or bulk imported. Ranking behavior was tested with explicitly synthetic fixtures. Actual recommendations change only after an operator records valid sourced prices for existing places.
- Keyboard regression follow-up: six onboarding interaction tests pass, covering sequential `5`/`7`/`0` input with live grouping, Vietnamese IME composition from both empty and already-formatted input, caret-preserving middle insertion/deletion, Backspace across a separator, grouped paste, decimal rejection, clearing and canonical API payload. A local headless Chrome run using the actual component and mocked APIs additionally passed real key-by-key input, middle editing, Backspace, and native CDP IME composition/commit. This does not claim testing the user's specific installed Vietnamese input application. No backend change is needed for this correction.
