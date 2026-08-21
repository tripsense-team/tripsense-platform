# Decisions & Tradeoffs: Place Search & Map Application

## Architectural Decisions

| Decision | Rationale | Alternatives Rejected |
| --- | --- | --- |
| **MapVina GL + MapVina streets style** | Matches the checked-in `mapvina-gl` dependency, `MapVinaContainer`, MapVina style URL, attribution, and POI interaction code. | The earlier MapLibre + generic OSM decision no longer describes the implementation. |
| **ZioMap backend plus MapVina browser fallback** | ZioMap supports persisted backend enrichment; MapVina keeps map/search usable when the backend yields no data. | Claiming all provider traffic is backend-only; that is not true in the current web client. |
| **Cache-Aside + Local-First Strategy** | Reduces external API costs and latency (<100ms on Redis hit, <300ms on MongoDB hit) while organically building the TripSense Da Nang place catalog over time. | Direct-proxy mode (always calls ZioMap on every query, slow & wasteful). |
| **Deterministic Ranking Formula** | Fully predictable, testable, fast, and transparent; isolated in `PlaceRankingService` for easy future AI enhancement. | Early AI/LLM ranking (adds cost, 1-3s latency, hallucination risks). |
| **MapVina marker instances for current release** | Matches the current `new mapvinagl.Marker(...)` implementation and card/marker synchronization. | Documenting native clustering before a clustered GeoJSON source/layer exists. |
| **Normalized Internal `Place` Schema** | Shields frontend components from ZioMap schema changes and allows swapping/adding other providers in the future. | Exposing raw external provider JSON. |

## Known Tradeoff

`NEXT_PUBLIC_MAPVINA_API_KEY` is intentionally browser-visible, but the repository currently also contains a hard-coded fallback token. Deployment must provide a restricted MapVina browser token, and removal of the hard-coded fallback is tracked as a security follow-up rather than described as already solved.

---

## Review Findings & Debate Summary

### Round 1: Product, Domain & Architecture
- *Finding*: Map bounds calculation should auto-fit markers on search result update, but not disorient the user if a specific place is clicked.
- *Decision*: Separate `fitBounds` trigger on new search results from single-point focus on `selectedPlaceId`.

### Round 2: Backend, Database & Security
- *Finding*: How to handle place photos and image URLs if ZioMap returns relative paths or missing photos?
- *Decision*: Normalize photo URLs to absolute HTTPS strings during normalization; provide graceful fallback placeholder UI with Lucide icons (no broken image icons).
- *Finding*: MongoDB index strategy for combined text + geo search.
- *Decision*: Use 2dsphere index for `$nearSphere` queries and compound text index for keyword matching.

### Round 3: Devil's Advocate Review
- *Challenge*: What happens if MongoDB has only 1-2 low-quality results for a broad query like "quán cafe chill gần biển"?
- *Resolution*: Define a threshold `minGoodResults = 5`. If MongoDB local search returns fewer than 5 results or matching score is below minimum relevance, immediately trigger ZioMap search and merge/upsert.
- *Challenge*: What if Redis crashes or is flushed?
- *Resolution*: Architecture treats Redis as strictly disposable. All cache lookup failures catch exceptions, log warnings, and fall through to MongoDB/ZioMap without dropping requests.
