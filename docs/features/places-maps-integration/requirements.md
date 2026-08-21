# Requirements: Place Search & Map Application

## User Goal

As a traveler exploring Da Nang (and future destinations), I want to enter natural language place searches (e.g. "top quán ăn ngon ở Đà Nẵng", "quán cafe chill gần biển", "nhà hàng hải sản ngon", "cafe đẹp để làm việc") and see relevant places displayed simultaneously in a structured list of cards and on an interactive MapVina map, with bi-directional selection and fast cached backend responses.

## Use Cases

1. **Text Search for Places**:
   - User inputs a search query into the search bar.
   - The application fetches normalized place results through the backend.
   - Results are rendered in the place card list and as interactive markers on MapVina GL.
   - Map bounds automatically zoom and pan to fit all returned results.
2. **Autocomplete Suggestions**:
   - User types in the search bar.
   - Frontend debounces keystrokes by 300ms.
   - The current web client requests MapVina autocomplete directly; backend autocomplete remains available through API Gateway.
3. **Card & Map Bi-directional Selection**:
   - Clicking a place card highlights the card, focuses/centers the map on that place's coordinates, and marks the marker as active.
   - Clicking a marker on the map selects that place, scrolls the corresponding place card into view, and highlights it.
   - Closing the selection resets `selectedPlaceId` to `null`.
4. **Place Detail View**:
   - Clicking "View details" or opening a place card fetches full place details (opening hours, photos, contact, description) on-demand.
5. **Nearby Place Discovery**:
   - User or system requests places around specific coordinates within a radius.

## Acceptance Criteria

1. **Map Engine**: Uses `mapvina-gl` with the MapVina streets style and MapVina attribution. The legacy `MapLibreContainer` export is only a compatibility alias for `MapVinaContainer`.
2. **External Places Providers**: ZioMap is called by `place-service`. The implemented web fallback calls MapVina Cloud directly with `NEXT_PUBLIC_MAPVINA_API_KEY`; this key is public by definition and must be treated as a restricted browser token, not a backend secret.
3. **Search Strategy (Local-First / Cache-Aside)**:
   - Check Redis cache for query hash (`place:search:{hash}`). On hit, return immediately (<100ms).
   - On miss, query MongoDB local collection using text and geospatial search.
   - If local results are insufficient (< threshold count or low relevance match), invoke ZioMap `/api/place/text-search`.
   - Discovered places from ZioMap are idempotently upserted into MongoDB (match by `provider` + `providerPlaceId`) and cached in Redis with configurable TTL (default 30m).
4. **Resilience & Redis Disposal**: If Redis is offline or cleared, the application continues functioning flawlessly against MongoDB and ZioMap.
5. **Place Card UI**:
   - Follows Mindtrip-inspired UI with theme tokens (no hardcoded colors).
   - Displays photo, title, rating, review count, categories, address/location, open status.
   - Never displays `undefined`, `null`, empty string placeholders, or fake dummy values.
6. **Marker Rendering**: The current MapVina container creates `mapvinagl.Marker` instances. Native GeoJSON clustering is not implemented yet and must not be claimed as complete.
7. **Configurability**: Initial default focus on Da Nang, Vietnam, configurable via `DEFAULT_CITY` and `DEFAULT_COUNTRY`.

## Business Rules

- **BR-01 (Idempotent Persistence)**: Re-fetching an existing place from ZioMap updates fields (e.g., rating, review count, photos, opening hours) without creating duplicate MongoDB documents.
- **BR-02 (Deterministic Ranking)**: In-memory/MongoDB ranking is computed deterministically using (1) Text relevance score, (2) Proximity to search center, (3) Rating, (4) User review count, (5) Freshness. AI ranking is prohibited in this phase.
- **BR-03 (Lightweight Search vs Heavy Details)**: Search results only return essential summary DTOs. Full details (complete photo gallery, opening hours structure, full description) are retrieved only when requested via `GET /api/places/:id`.

## Edge Cases

1. **ZioMap API Outage / Rate Limit**: Return existing MongoDB matching results or cached Redis results gracefully; if none found, return structured friendly error (`SERVICE_UNAVAILABLE` or empty list with guidance).
2. **Missing Place Location / Coordinates**: Exclude places with invalid coordinates from map layers while preserving them in list view with a "Location unavailable" indicator.
3. **Special Characters & Diacritics in Vietnamese**: Query normalization handles both accented Vietnamese ("Đà Nẵng", "quán ăn") and unaccented terms ("da nang", "quan an").
4. **Empty Search Query**: Return default trending/recommended Da Nang places or empty state.

## Out Of Scope

- AI / LLM search processing or AI chat recommendations (Phase 1 is 100% deterministic).
- Trip planning, itinerary generation, route navigation.
- User reviews creation, favorites sync to user account, booking integrations.
- Google Maps SDK, route navigation, and additional map-provider integrations.

## Open Questions

- *None remaining*: Architecture and boundary rules are strictly defined.
