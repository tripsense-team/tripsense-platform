# Data Model

## Owning Service

`services/trip-service` owns all TF-47 persistence. This service does not exist in the current source tree and must be created during approved implementation.

## Schema Changes

Create a new PostgreSQL-backed `trip-service` database schema with these tables. Redis is used only as a cache and is not a source of truth.

### `trips`

| Column | Notes |
| --- | --- |
| `id UUID PK` | Trip identifier. |
| `owner_user_id UUID NOT NULL` | User reference by ID only. |
| `name VARCHAR(160) NOT NULL` | User-visible trip name. |
| `destination_name VARCHAR(255) NOT NULL` | Display destination. |
| `destination_place_id UUID NULL` | Optional reference to Place Service. |
| `start_date DATE NOT NULL` | Inclusive start. |
| `end_date DATE NOT NULL` | Inclusive end. |
| `status VARCHAR(32) NOT NULL` | `DRAFT`, `CONFIRMED`, `CANCELLED`, `ARCHIVED`. |
| `traveler_count INT NULL` | Optional traveler count. |
| `budget_amount DECIMAL(14,2) NULL` | Optional budget. |
| `budget_currency VARCHAR(3) NULL` | ISO-style currency code. |
| `notes TEXT NULL` | User notes. |
| `cover_image_url VARCHAR(1024) NULL` | Optional cover. |
| `version BIGINT NOT NULL` | Optimistic locking. |
| `archived_at TIMESTAMP NULL` | Archive marker. |
| `deleted_at TIMESTAMP NULL` | Reserved for approved hard/soft delete policy. |
| `created_at TIMESTAMP NOT NULL` | Audit timestamp. |
| `updated_at TIMESTAMP NOT NULL` | Audit timestamp. |

### `itinerary_days`

| Column | Notes |
| --- | --- |
| `id UUID PK` | Day identifier. |
| `trip_id UUID NOT NULL FK trips(id)` | Local FK inside `trip-service`. |
| `day_date DATE NOT NULL` | Calendar date. |
| `day_number INT NOT NULL` | 1-based day number. |
| `version BIGINT NOT NULL` | Optimistic locking for day-level edits. |
| `created_at TIMESTAMP NOT NULL` | Audit timestamp. |
| `updated_at TIMESTAMP NOT NULL` | Audit timestamp. |

### `itinerary_items`

| Column | Notes |
| --- | --- |
| `id UUID PK` | Item identifier. |
| `trip_id UUID NOT NULL` | Denormalized local trip ID for ownership checks. |
| `day_id UUID NOT NULL FK itinerary_days(id)` | Local day reference. |
| `place_id UUID NULL` | Optional Place Service reference; no DB FK. |
| `title VARCHAR(200) NOT NULL` | Required for place and manual items. |
| `item_type VARCHAR(32) NOT NULL` | `PLACE`, `MEAL`, `HOTEL`, `FLIGHT`, `TRANSFER`, `NOTE`, `ACTIVITY`. |
| `start_time TIME NULL` | Optional. |
| `end_time TIME NULL` | Optional. |
| `duration_minutes INT NULL` | Optional positive duration. |
| `sort_order INT NOT NULL` | Stable ordering within a day. |
| `status VARCHAR(32) NOT NULL` | `PLANNED`, `DONE`, `SKIPPED`, `CANCELLED`. |
| `notes TEXT NULL` | User notes. |
| `place_name_snapshot VARCHAR(255) NULL` | Optional display fallback. |
| `place_address_snapshot VARCHAR(512) NULL` | Optional display fallback. |
| `lat_snapshot DECIMAL(10,7) NULL` | Optional display fallback. |
| `lng_snapshot DECIMAL(10,7) NULL` | Optional display fallback. |
| `version BIGINT NOT NULL` | Optimistic locking. |
| `created_at TIMESTAMP NOT NULL` | Audit timestamp. |
| `updated_at TIMESTAMP NOT NULL` | Audit timestamp. |

## Migrations

- Add `services/trip-service/src/main/resources/db/migration/V1__create_trip_tables.sql`.
- Migration is additive because the service is new.
- Non-production rollback may drop child tables before parent tables.
- Production rollback should disable routes and leave data intact unless explicitly approved.

## Indexes

- `trips(owner_user_id, status, start_date)`
- `trips(owner_user_id, archived_at, start_date)`
- `itinerary_days(trip_id, day_date)` unique
- `itinerary_days(trip_id, day_number)` unique
- `itinerary_items(day_id, sort_order)` unique
- `itinerary_items(trip_id, day_id)`
- `itinerary_items(place_id)`

## Transaction Boundaries

- Create trip and its itinerary days in one local transaction.
- Update trip metadata and allowed date changes in one local transaction.
- Add, edit, remove, and reorder itinerary items in one transaction scoped to one owned trip/day.
- Validate remote `placeId` before opening the write transaction where practical, so the database is not held while waiting on another service.
- Reorder uses optimistic version checks plus row locks or gap-safe temporary order values before writing contiguous sort orders.

## Data Consistency

- Date shrink is blocked if itinerary items would fall outside the new date range.
- Existing itinerary reads render from saved state and snapshots even if `place-service` is unavailable.
- Item overlaps are allowed in storage and surfaced as warnings.
- Queries exclude archived trips by default unless explicitly requested.

## Migration Risks

- New service creation must include database config, Flyway config, discovery registration, Docker config, and CI/CD wiring.
- Unique ordering updates can conflict under concurrent edits without version checks.
- Future `itinerary-service` extraction will require moving these tables or creating contracts around itinerary ownership.

## Prohibited Patterns Check

- No cross-service JPA relationships.
- No direct access to another service database.
- No database FK to `user-service` or `place-service`.
