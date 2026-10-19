# Preserve provider primaryType for discovery — revision 3
`STATUS: IMPLEMENTING`

Application changes and automated verification complete; live UI/data acceptance pending.

Human approval: on 2026-10-19 user explicitly said “Giờ tiến hành implements đi”
after agreeing to preserve primaryType separately, retain it on Details updates, use it
for discovery grouping and conservatively handle missing historical values.

This revision supersedes revisions 1–2: NO audit tool, provider preview script,
data import/backfill, category-name guessing system or production provider calls.

## 1. Requirements
- Add nullable primaryType to Place, PlaceDto and canonical Recommendation snapshot.
- Capture the actual provider field from search and Details when supplied. Validate
  normalized ASCII type codes; never invent primaryType from categories[0], name or types.
- Missing/blank/invalid primaryType on refresh MUST preserve the existing stored value.
  Existing raw categories remain provider labels and may update independently.
- Prefer explicit supported primaryType for For You and all grouped category tabs.
  Generic or missing values fall back only to specific structured labels; conflicting
  groups produce UNKNOWN rather than arbitrary owner priority. Keep existing bounded
  Homestay name fallback only for legacy data without a specific primary type.
- Generic food/store/point_of_interest/establishment cannot alone prove an eatery.
  Unsupported specific primary types cannot be overridden by incidental food/tourism tags.
- Broad STAY retains lodging/Homestay semantics. Preserve strict named search outside
  grouped discovery, ranking weights, geofence, source/profile/impression call counts.
- Test example: primaryType=coffee_shop plus food/tourist_attraction labels => CAFE
  in both preview and Cafe tab, never FOOD/ATTRACTION. Museum primary beats cafe tags.

## 2. Architecture and contracts
Place owns Mongo/provider fields; Recommendation receives optional primaryType through
canonical HTTP DTOs and caches. Additive nullable field only; old consumers ignore it.
No cross-service DB access, new API, service, event or public endpoint.
Existing semantic candidates are resolved to canonical snapshots before classification.
No requirement to rewrite embeddings just to change grouping.

## 3. Policy and retrieval
Use exact normalized type-code sets (including common official restaurant subtypes,
coffee/cafe types, museums/nature/recreation/worship, lodging). Localized aliases are
legacy fallback only, not valid fabricated primaryType values. Shared fixture tests
keep Place/Recommendation owner and membership behavior compatible.
Unknown/conflicting historical records may leave discovery groups; named search/details
still work. Do not promise full legacy correction without primary evidence/backfill.
Mongo coarse predicate includes primaryType OR legacy fallback candidates, before a
bounded overfetch <=min(target*4,200); final classification precedes per-category target.
No unbounded fill loop. Keep finite Mongo timeout and existing partial-batch budget.

## 4. Persistence/cache
Nullable Mongo field, no mandatory migration or backfill, no raw-label rewrites.
Existing category caches, grouped response/LKG and seeds must get versioned namespaces/
compatibility so stale DTOs and classifications are not reused. No FLUSH/shared-key deletion.
Do not clear stored primaryType during enrichment, provider upsert or partial DTO merge.
Rollback code/namespace together; the additive field can remain inert.

## 5. Security and scope
No new auth surface, secrets, user data, schema ownership change or live external call.
Type codes validated/bounded; logs only aggregate counts and safe failure types.
No auto-enrichment, reindex, importer or live canonical DB writes during verification.

## 6. Tasks and verification
1. Provider/DTO/entity roundtrip and missing/blank/invalid refresh preservation tests.
2. Canonical HTTP/semantic hydration/cache propagation tests, compatible older DTOs.
3. Shared primaryType/fallback conflict fixtures for preview and category detail.
4. Real disposable Mongo queries with primary/legacy cases; all offline Place/Reco suites,
   excluding SemanticCloudIntegrationTest. Check architecture/security/database/PR fit.
5. Manual acceptance: restart only Place and Recommendation, fully reload browser.
   No claim that old 1465 records immediately gain primaryType. Live backfill is separate.

Evidence: two user-authorized ZioMap probes on 2026-10-19 returned primaryType=coffee_shop
from Text Search; legacy Details of the same place omitted it. Not a guarantee of coverage
for all places. No further provider requests needed for this implementation.

## Implementation evidence (2026-10-19)

- Nullable primaryType now travels through ZioMap search/details DTOs, Place DTO/entity,
  persistence mapping, canonical Recommendation HTTP snapshots and optional index DTOs.
  Missing/blank/invalid incoming values preserve stored primary; categories update as before.
- Explicit primary type wins over incidental tags in preview and selected-category views.
  Missing/generic primary falls back to structured specific aliases; conflicting groups
  remain unknown. Generic food alone is no longer sufficient. Existing Homestay-only
  legacy name fallback is retained; no new name-guessing system was introduced.
- Primary classification uses exact type-code sets. Mongo retrieval uses primaryType or
  bounded legacy alias predicates, 4x overfetch (max200), final classification before target,
  excludes heavy review/sourceData fields and retains 400ms Mongo execution bound.
- Versioned Place search/detail/category cache and grouped response scope/seed namespace.
  No flush or shared-key deletion. Old incompatible seeds are ignored safely.
- Raw category labels were not reordered/reclassified by a migration. Historical records
  were not backfilled and no live provider/DB/cache/vector mutation was performed.
- Full verification: **126 Place + 223 Recommendation = 349 tests passed**, zero
  failures/errors/skips, including architecture checks and actual disposable MongoDB.
  Shared primary/fallback fixtures cover 26 cases in each service. Tests verify provider
  mapping, preservation during both enrichment/upsert, canonical hydration, JSON snapshots,
  old seed exclusion, preview/detail consistency and unchanged embedding document hashes.
- Scoped Spotless and whitespace checks passed. Architecture/database/security/PR self-review:
  additive optional contracts only; no new endpoints/auth changes, cross-service persistence,
  destructive migration or external-call side effect introduced. Existing indexing delivery
  behavior remains unchanged; primaryType alone does not alter the semantic content hash.
- Pending manual acceptance: Ctrl+C only Place and Recommendation in existing terminals;
  run `bash scripts/start.sh`; fully reload browser (not Back to old in-memory preview).
  Test preview, Food/Cafe/Attraction tabs and detail refresh. Data without explicit primary
  cannot be magically repaired; do not judge completeness as a backfill guarantee.

Verification used JDK21 and Mockito javaagent, offline Maven; cloud test excluded:
```bash
mvn -o -B -ntp -pl services/place-service,services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dplace.category.integration=true -Dsurefire.failIfNoSpecifiedTests=false
```
