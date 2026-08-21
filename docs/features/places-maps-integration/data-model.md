# Data Model & Persistence: Place Search & Map Application

## Owning Service

- **Owner**: `services/place-service`
- **Datastores**: MongoDB (`places` collection), Redis (cache keys).
- **Provider scope**: `place-service` currently persists normalized ZioMap results. MapVina results returned by the browser fallback remain client-side and are not written to this collection.

---

## MongoDB Schema (`places`)

```json
{
  "_id": ObjectId("66c4a1b2e4b01234567890ab"),
  "provider": "ziomap",
  "providerPlaceId": "zm_dn_madame_lan_01",
  "name": "Madame Lan Restaurant",
  "normalizedName": "madame lan restaurant",
  "location": {
    "type": "Point",
    "coordinates": [108.2208, 16.0678]
  },
  "address": "04 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng, Vietnam",
  "city": "Da Nang",
  "district": "Hải Châu",
  "categories": [
    "restaurant",
    "vietnamese",
    "local_food"
  ],
  "rating": 4.6,
  "userRatingCount": 1200,
  "photos": [
    "https://images.ziomap.com/photos/zm_dn_madame_lan_01_main.jpg"
  ],
  "phone": "+84 905 697 555",
  "website": "https://madamelan.vn",
  "openingHours": "06:30 - 21:30",
  "description": "Popular riverside dining serving authentic Vietnamese specialties.",
  "sourceData": {
    "rawZioMapId": "zm_dn_madame_lan_01"
  },
  "createdAt": ISODate("2026-08-20T10:00:00Z"),
  "updatedAt": ISODate("2026-08-20T10:00:00Z"),
  "lastFetchedAt": ISODate("2026-08-20T10:00:00Z")
}
```

### Java Entity Class Blueprint

```java
package fu.tripsense.placeservice.domain.model;

import lombok.Builder;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@Document(collection = "places")
@CompoundIndex(name = "provider_place_idx", def = "{'provider': 1, 'providerPlaceId': 1}", unique = true)
public class Place {
    @Id
    private String id;

    private String provider;
    private String providerPlaceId;

    @TextIndexed(weight = 5)
    private String name;
    private String normalizedName;

    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;

    @TextIndexed(weight = 2)
    private String address;
    private String oldAddress;
    private String city;
    private String district;

    @TextIndexed(weight = 3)
    private List<String> categories;

    private Double rating;
    private Integer userRatingCount;
    private List<String> photos;
    private String phone;
    private String website;
    private List<String> socials;
    private String openingHours;
    private String businessStatus;
    private List<PlaceReview> reviews;

    @TextIndexed(weight = 1)
    private String description;

    private Map<String, Object> sourceData;

    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;
    private Instant lastFetchedAt;
}
```

---

## Indexes

1. **Unique Compound Index**: `{ provider: 1, providerPlaceId: 1 }` (Enforces idempotency and prevents duplicate places).
2. **2dsphere Geospatial Index**: `{ location: "2dsphere" }` (Enables `$nearSphere` and `$geoWithin` fast radius queries).
3. **Text Search Index**: `{ name: "text", categories: "text", address: "text", description: "text" }` with weights `{ name: 5, categories: 3, address: 2, description: 1 }`.

---

## Redis Cache Key Design & TTLs

| Cache Key Pattern | Purpose | Default TTL | Config Env Var |
| --- | --- | --- | --- |
| `place:search:{hash(query_normalized)}` | Search results array | 30 minutes | `CACHE_TTL_SEARCH_SECONDS=1800` |
| `place:autocomplete:{hash(query_normalized)}` | Autocomplete suggestions | 60 minutes | `CACHE_TTL_AUTOCOMPLETE_SECONDS=3600` |
| `place:details:{internalPlaceId}` | Single place details DTO | 12 hours | `CACHE_TTL_DETAILS_SECONDS=43200` |
| `place:provider:{provider}:{providerPlaceId}` | Cached provider detail lookup | 30 days | `CACHE_TTL_PROVIDER_SECONDS=2592000` |

---

## Transaction & Idempotency Boundaries

- When ZioMap returns search results, `place-service` performs an idempotent lookup by `{ provider, providerPlaceId }`, updates or creates each entity, and saves it through `PlaceRepository`.
- Redis cache operations are synchronous, but cache exceptions are caught and logged so they do not fail the primary search/details flow.
- MongoDB is the single source of truth; Redis is completely disposable.

## Prohibited Patterns Check

- No cross-service JPA/MongoDB relationships.
- No direct database access from other microservices.
