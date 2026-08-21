# Security & Trust Boundaries: Place Search & Map Application

## Credential Handling & Provider Isolation

- **ZioMap secret**: The ZioMap API key remains backend-only through `ZIOMAP_API_KEY`; `place-service` reads its base URL from `ZIOMAP_BASE_URL`.
- **Current ZioMap gap**: `docker-compose.yml` currently assigns a concrete `ZIOMAP_API_KEY` value. Remove it from versioned configuration, load it from an ignored environment/secret source, and rotate the exposed credential.
- **MapVina browser token**: The web map and direct MapVina fallback use `NEXT_PUBLIC_MAPVINA_API_KEY`. Any `NEXT_PUBLIC_*` value is embedded in the browser bundle, so this must be a domain/referer-restricted public token with least-privilege provider settings.
- **Current gap**: `mapvina-container.tsx` and `places-api.ts` contain a hard-coded fallback token. This is an implementation risk to remove; the documentation does not treat that token as secret or claim zero client exposure.
- **Direct provider boundary**: Search/details try the TripSense backend first, but browser fallback and autocomplete can bypass API Gateway, Redis, MongoDB persistence, and gateway rate limiting.

---

## Authentication & Authorization

- `GET /api/places/search`, `GET /api/places/autocomplete`, `GET /api/places/:id`, `GET /api/places/nearby` are public discovery endpoints.
- No user authentication is required for basic place browsing, maintaining zero barrier to entry for travelers.
- Future write/curation endpoints (e.g. adding custom places, flagging incorrect data) will require authenticated role-based access.

---

## Input Validation & Sanitization

- **Query Sanitization**: Strip dangerous characters, limit search query length to 200 characters to prevent buffer and regex injection.
- **Geographic Coordinate Validation**:
  - `lat` strictly validated in `[-90.0, 90.0]`.
  - `lng` strictly validated in `[-180.0, 180.0]`.
  - `radius` strictly capped at `50,000` meters (50km).
  - `limit` strictly clamped to `[1, 50]`.
- **ID Validation**: `GET /api/places/:id` validates hex string length (MongoDB ObjectId or provider ID format) before database or provider query to prevent query tampering.

---

## Abuse Prevention & Rate Limiting

- **Frontend Debouncing**: Autocomplete is throttled to 300ms debounce on keystroke to avoid API flooding.
- **API Gateway Rate Limiting**: Limit `/api/places/**` requests per client IP to protect ZioMap quota and backend resources. This does not cover direct MapVina browser calls; MapVina token restrictions and provider quotas must cover that path.
- **Redis Cache Layer**: Absorbs identical searches, shielding both internal MongoDB and external ZioMap API from brute-force queries.

---

## Error Sanitization & Data Masking

- In case of external ZioMap failures or database connection errors, the backend returns a generic, friendly response code (`503 SERVICE_UNAVAILABLE` or graceful empty/cached list).
- Stack traces, internal IP addresses, database connection strings, and provider error dumps are strictly suppressed in API Gateway and Place Service exception handlers.

## Required Follow-up

Rotate and remove the inline ZioMap credential from `docker-compose.yml`. Remove the hard-coded MapVina token fallback. If MapVina search/details must remain a resilience feature, issue a restricted browser token and document its allowed origins, APIs, quota, and rotation procedure. Otherwise, proxy those calls through `place-service` and keep the credential backend-side.
