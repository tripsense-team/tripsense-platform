# Partner Location Autocomplete

`STATUS: DONE`

- Date: 2026-09-30
- Implementation: reused `getAutocomplete` and `getPlaceDetails` from `places-api.ts` directly from `origin/dev` without modifying shared API client. Wizard UI aligns with `search-bar.tsx` autocomplete pattern from `origin/dev`.
- Owner: existing Place Service; affected application: `apps/web/tripsense`.

## 1. Goal and scope

Replace text search in the HOTEL/RESTAURANT partner wizard location field with existing autocomplete. At least two characters, 300 ms debounce, request up to 10 suggestions. Display title/subtitle, resolve the chosen ID through details before marking a place selected or submitting its canonical ID/address/coordinates. Preserve manual address entry and partner candidate/claim workflows.

Exclude new search modes, text-search fallback, cache-on-confirmation changes, geographic bias changes, new maps and unrelated review fixes. Existing backend autocomplete retains its default Da Nang anchor, Redis TTL (one hour by default), and local fallback on provider failure/empty results. Autocomplete need not contact ZioMap on every keystroke.

## 2. Architecture

Browser uses API Gateway and existing Place Service. Place Service calls ZioMap `/api/autocomplete` on cache miss and `/api/place/details` when details need retrieval. No direct browser provider calls. Place owns POI/cache; Trip receives IDs/snapshots, never queries Place DB. No new service or async event.

## 3. Contracts

- `GET /api/places/autocomplete?q=...&limit=10`: existing public endpoint; response `{success,data:[{id,title,subtitle?,category?}]}`.
- `GET /api/places/{id}`: existing public endpoint; response `{success,data:Place}`. Wizard must not use a name fallback that could select a different business.
- Use `apiClient` for autocomplete/details, preserve existing helper signatures and AbortSignal support. Other endpoints unchanged.
- Existing backend validation/error codes remain unchanged. UI distinguishes loading, empty results, and sanitized error; retry via selecting again or retrying search.

## 4. Data and rollback

No schema, migration, cache policy or event changes. Existing details persistence remains owned by Place. Rollback only the feature diff, preserving unrelated working-tree changes.

## 5. Security and accessibility

Provider secrets stay backend-side. POI selection is not proof of ownership. Preserve auth/ownership checks on partner submission. Render text, not provider HTML; sanitize errors; no token/raw exception logging. Translate touched lookup labels/states with en/vi parity. Native buttons allow keyboard selection; label input and icon buttons.

## 6. Races and tradeoffs

Abort and invalidate stale search/details requests on query change, selection change, modal close, kind change or leaving lookup step. Stale responses must not overwrite current selection, editable fields, errors, loading or conflict state. Details failure must not create a fake Place from a suggestion. Disable submit/advance and affected editable fields while resolving details. Keep available suggestions for retry or choosing another result. Existing cache/local fallback may return non-live data; changing this is deferred explicitly.

## 7. Tasks and verification

- Update partner wizard to AutocompleteSuggestion/getAutocomplete, then resolve valid details by ID.
- Reuse existing safe API client for touched Place helpers; preserve callers.
- Add a small Vitest component test file for debounce, request parameters, details success/failure, stale requests/close/clear/selection and canonical submission. Update helper tests as needed; no new dependencies.
- From `apps/web/tripsense`: `npm test -- src/features/partner src/features/places`, `npm run type-check`, `npm run i18n:check`.
- Review boundaries/data/security/diff. Browser verification if services available: open wizard step 2, inspect autocomplete and details requests and chosen address; never submit real partner applications without permission.
- Record actual checks and limitations before marking DONE.
