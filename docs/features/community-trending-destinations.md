# Community Trending Destinations — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`
- **Created Date**: 2026-09-24
- **Target PR Boundaries**: [Phase 1 (Backend Contract & DTOs), Phase 2 (Aggregation & Service Logic), Phase 3 (Frontend Web Verification)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, the Community page (`/community`) features a "Trending Destinations" widget in the right-hand discovery rail. The web frontend invokes `GET /api/social/destinations/trending`, which previously failed with HTTP 404/500 before falling back to local client mock data. 

This feature delivers a live backend API in `social-service` that serves curated Vietnamese travel destinations (Đà Lạt, Phú Quốc, Ninh Bình, Sa Pa, Đà Nẵng, Hà Nội) enriched with dynamic community share counts aggregated from public trip shares (`social_trip_shares`), encouraging users to explore places and itineraries for trending travel spots.

### 1.2 User Flows & Journey
1. **User loads Community page (`/community`)**:
   - The right sidebar displays the "Trending Destinations" widget with top 4 trending travel destinations.
   - Each destination showcases a high-resolution hero landscape, localized destination name, seasonal highlight subtitle, and total share count (e.g., "1.4k chia sẻ").
2. **User clicks on a trending destination**:
   - Browser navigates to `/explore?destination={slug}` (e.g., `/explore?destination=da-lat`), allowing the user to search places, food, and stays for that specific city.
3. **When users share trips to a destination**:
   - The destination's share count updates automatically by aggregating public shares from `social_trip_shares`.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Backend endpoint `GET /api/social/destinations/trending` (with optional `limit` parameter, default 4).
  - Hybrid aggregation model: Curated Vietnamese destination catalog (Da Lat, Phu Quoc, Ninh Binh, Sa Pa, Da Nang, Ha Noi) with high-res photography and seasonal copy, combined dynamically with real counts from `social_trip_shares`.
  - Normalization for destination matching (handling both accented and unaccented names like "Đà Lạt" and "Da Lat").
  - Alignment with existing frontend type `TrendingDestination` and i18n keys (`destinationDalat`, `trendSubtitleDalat`, etc.).
  - Unit tests for service and controller in `services/social-service`.
- **Out-of-Scope**:
  - Full CRUD admin CMS for managing destination photos (future iteration).
  - Weather widget backend (`/api/social/weather`) - handled in a separate feature plan.

### 1.4 Acceptance Criteria
- [x] **AC-1**: `GET /api/social/destinations/trending` returns HTTP 200 with standard `ApiResponse<List<TrendingDestinationResponse>>`.
- [x] **AC-2**: Contract matches frontend schema: `id`, `name`, `cityNameKey`, `imageUrl`, `shareCountText`, `shareCount`, `subtitle`, `subtitleKey`, `slug`.
- [x] **AC-3**: Query param `limit` is validated (1 to 10, default 4). Invalid limits return HTTP 400 (`INVALID_LIMIT`).
- [x] **AC-4**: Share count combines base seed count + actual count of public `social_trip_shares` matching the destination.
- [x] **AC-5**: Destinations are ordered by total `shareCount` descending.
- [x] **AC-6**: Clicking a destination card on the web navigates to `/explore?destination={slug}`.
- [x] **AC-7**: All unit and integration tests pass with 0 regressions.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[User Browser / Next.js Web]
         |
         | GET /api/social/destinations/trending?limit=4
         v
[API Gateway (:8080)]
         |
         | Forward to social-service (:8086)
         v
[SocialDestinationController]
         |
         | Invokes SocialDestinationService
         v
[social_trip_shares (PostgreSQL)] 
   -> Aggregates COUNT(*) of public shares per destination
   -> Merges with Curated Destination Catalog (base count + real count)
   -> Returns sorted list of Trending Destinations
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Renders `TrendingDestinationsWidget`, links to `/explore?destination={slug}` | HTTP REST |
| `services/api-gateway` | Rate limiting, CORS, reverse proxy to `social-service` | Spring Cloud Gateway |
| `services/social-service` | Owns `social_trip_shares`, aggregation logic, and curated catalog | Spring Boot REST |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic goes through API Gateway.
- [x] Zero cross-service database queries (`social-service` queries only its own `social_trip_shares` table).
- [x] No cross-service JPA relationships.
- [x] Idempotent and read-only query operation.
- [x] Frontend adheres to Zero-Leak Error Handling standards.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
| Method | Gateway Path | Service Internal Path | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/social/destinations/trending` | `/api/social/destinations/trending` | None (Public) | Fetch list of trending destinations |
| `GET` | `/api/social/trending-destinations` | `/api/social/trending-destinations` | None (Public) | Alias route |

#### Query Parameters
- `limit` (optional, integer, default: 4, min: 1, max: 10): Maximum number of destinations returned.

#### Response DTO (200 OK)
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "trend-dalat",
      "name": "Đà Lạt",
      "cityNameKey": "destinationDalat",
      "imageUrl": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80",
      "shareCountText": "1.4k chia sẻ",
      "shareCount": 1420,
      "subtitle": "Mùa hoa dã quỳ nở rộ",
      "subtitleKey": "trendSubtitleDalat",
      "slug": "da-lat"
    },
    {
      "id": "trend-phuquoc",
      "name": "Phú Quốc",
      "cityNameKey": "destinationPhuQuoc",
      "imageUrl": "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80",
      "shareCountText": "980 chia sẻ",
      "shareCount": 980,
      "subtitle": "Hoàng hôn Bãi Sao và lặn biển",
      "subtitleKey": "trendSubtitlePhuQuoc",
      "slug": "phu-quoc"
    }
  ],
  "timestamp": "2026-09-24T08:00:00Z"
}
```

---

## 4. Data Model & Catalog

### 4.1 Existing Table Query
In `services/social-service`, table `social_trip_shares`:
```sql
SELECT destination_name, COUNT(*) 
FROM social_trip_shares 
WHERE visibility = 'PUBLIC' AND removed_at IS NULL AND destination_name IS NOT NULL
GROUP BY destination_name;
```

### 4.2 Seed Catalog (Vietnamese Top Destinations)
A curated immutable catalog configured in `services/social-service`:
1. **Đà Lạt** (`slug: da-lat`, `key: destinationDalat`, `subtitleKey: trendSubtitleDalat`, base: 1420)
2. **Phú Quốc** (`slug: phu-quoc`, `key: destinationPhuQuoc`, `subtitleKey: trendSubtitlePhuQuoc`, base: 980)
3. **Ninh Bình** (`slug: ninh-binh`, `key: destinationNinhBinh`, `subtitleKey: trendSubtitleNinhBinh`, base: 760)
4. **Sa Pa** (`slug: sa-pa`, `key: destinationSaPa`, `subtitleKey: trendSubtitleSaPa`, base: 620)
5. **Đà Nẵng** (`slug: da-nang`, `key: destinationDaNang`, `subtitleKey: trendSubtitleDaNang`, base: 510)
6. **Hà Nội** (`slug: ha-noi`, `key: destinationHaNoi`, `subtitleKey: trendSubtitleHaNoi`, base: 430)

### 4.3 Share Count Formatting
- `< 1000`: `"{count} chia sẻ"` (e.g., `"980 chia sẻ"`)
- `>= 1000`: `"{formatted}k chia sẻ"` (e.g., `"1.4k chia sẻ"`)

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Public Exposure** | Endpoint is public and read-only. No user-identifiable data or tokens exposed. |
| **Input Validation** | Parameter `limit` is validated to be between 1 and 10 to avoid denial of service. |
| **Database Load** | Catalog aggregation uses indexed columns or small in-memory group count, zero unbounded table scans. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Destination Name Variation** | Users may input "Đà Lạt", "Đà lạt", "Da Lat", "Dalat" | Match destination names with case-insensitive and accent-insensitive normalization so all variants roll into the correct city count. |
| **Cold-Start / Empty Database** | If a new deployment has zero shared trips, widget looks empty | Hybrid approach seeds with realistic base count so the UI always has stunning visuals, with real shares incrementing live. |
| **Performance** | Frequent queries to `social_trip_shares` | Fast group count query over public shares; results can be cached with Spring `@Cacheable` (TTL 5 mins) if needed. |

---

## 7. Phased Implementation Tasks

### Phase 1: Backend DTOs & Service
- [x] Task 1.1: Create `TrendingDestinationResponse.java` DTO in `services/social-service`.
- [x] Task 1.2: Add repository query in `SocialTripShareRepository.java` to count public shares grouped by destination name.
- [x] Task 1.3: Create `SocialDestinationService` & `SocialDestinationServiceImpl` with destination catalog and normalization.
- [x] Task 1.4: Expose `GET /api/social/destinations/trending` and alias `/api/social/trending-destinations` in `SocialDestinationController.java`.
- [x] Task 1.5: Write unit tests: `SocialDestinationServiceImplTest.java` and `SocialDestinationControllerTest.java`.

### Phase 2: Gateway & Frontend Verification
- [x] Task 2.1: Verify API Gateway routing (`/api/social/**` to `social-service`).
- [x] Task 2.2: Ensure frontend i18n keys for all catalog cities exist in `en.json` and `vi.json`.
- [x] Task 2.3: Verify Next.js `/community` page live integration and run vitest suite.

### Verification Commands
```bash
# Backend Tests (65/65 passed)
mvn -pl services/social-service test

# Frontend Tests (120/120 passed)
cd apps/web/tripsense && npm test
```

---

## Status

```text
STATUS: DONE
```
> Tính năng **Điểm đến thịnh hành (Trending Destinations)** đã được triển khai hoàn chỉnh, pass toàn bộ unit test backend và frontend, xác minh trực tiếp qua API Gateway thành công.
