# Data Model & Persistence: Place Search & Map Application

## Ownership

- Owner: `services/place-service`.
- Durable store: MongoDB `places` collection.
- Disposable cache: Redis `place:*` keys.
- Persisted provider: normalized ZioMap place data. MapVina is a basemap renderer, not a persistence source.
- No other service reads or writes the place database directly.

## Place Document

```json
{
  "_id": "66c4a1b2e4b01234567890ab",
  "provider": "ziomap",
  "providerPlaceId": "zm_dn_01",
  "name": "Madame Lan Restaurant",
  "normalizedName": "madame lan restaurant",
  "location": {
    "type": "Point",
    "coordinates": [108.2208, 16.0678]
  },
  "address": "04 Bach Dang, Hai Chau, Da Nang",
  "city": "Da Nang",
  "district": "Hai Chau",
  "categories": ["restaurant", "vietnamese"],
  "rating": 4.6,
  "userRatingCount": 1200,
  "photos": [],
  "phone": "+84 905 697 555",
  "website": "https://example.com",
  "socials": [],
  "openingHours": "06:30 - 21:30",
  "businessStatus": "OPERATIONAL",
  "reviews": [],
  "description": "Riverside Vietnamese restaurant",
  "createdAt": "2026-08-20T10:00:00Z",
  "updatedAt": "2026-08-20T10:00:00Z",
  "lastFetchedAt": "2026-08-20T10:00:00Z"
}
```

`rating`, counts, contact data, hours, status, and description are optional. Missing provider facts stay null/absent; list fields are normalized to empty lists at the DTO boundary.

## Indexes

| Index | Purpose |
| --- | --- |
| Unique `{ provider: 1, providerPlaceId: 1 }` | Idempotent provider upsert and duplicate prevention |
| `2dsphere` on `location` | Radius/nearby queries |
| Weighted text index on `name`, `categories`, `address`, `description` | Deterministic local keyword search |

## Cache Keys

| Key | Purpose | Default TTL |
| --- | --- | --- |
| `place:search:{hash}` | Normalized search result | 30 minutes |
| `place:autocomplete:{hash}` | Suggestions | 60 minutes |
| `place:details:{id}` | Detail DTO | 12 hours |
| `place:provider:{provider}:{providerPlaceId}` | Provider detail | 30 days |

TTL values are environment-configurable. Cache failure does not alter MongoDB ownership or prevent the primary flow.

## Consistency and Transactions

- Provider results are looked up by `(provider, providerPlaceId)`, merged, and saved within `place-service`.
- MongoDB remains the source of truth; Redis can be flushed and rebuilt.
- Transactions do not span services or external provider calls.
- No cross-service JPA/MongoDB relationship, shared writable table, or foreign database access exists.

## Migration Risk

This remediation does not change the stored schema or require a migration. It separates application responsibilities and removes unused MapVina DTO/config classes only.
