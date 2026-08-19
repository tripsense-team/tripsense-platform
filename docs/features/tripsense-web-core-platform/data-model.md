# Data Model

## Owning Service

Durable data is owned by backend services. The Next.js web app must not own TripSense domain tables.

| Data | Owner |
| --- | --- |
| Trips, trip lifecycle, trip ownership | `trip-service` |
| Itinerary days/items, reorder/move state | `itinerary-service` or approved combined trip owner |
| Places, external references, enrichment metadata, provider cache, route cache | `place-service` |
| TripSense feedback and rating summaries | `review-service` |
| Favorites and collections | `user-service` |
| Place intelligence facts | `context-service` or explicitly approved initial owner |

## Schema Changes

Milestone 1:

- `trips`
  - `id` UUID primary key
  - `owner_id`
  - `name`
  - `destination`
  - `start_date`
  - `end_date`
  - `status`
  - `created_at`
  - `updated_at`

Later milestones:

- `itinerary_days`: `id`, `trip_id`, `date`, `day_number`, timestamps.
- `itinerary_items`: `id`, `itinerary_day_id`, nullable `place_id`, title/details/time/duration/sequence/status/note, timestamps.
- `places`: internal TripSense place identity and normalized location fields.
- `place_external_references`: provider to external place ID mapping.
- `place_enrichment_metadata`: provider-attributed image, description, tourism kinds, Wikipedia/Wikidata references, attribution, confidence, and freshness fields.
- `provider_cache_entries` and optional `route_cache_entries`: provider request cache with TTL/failure metadata.
- `place_feedback` and `place_rating_summaries`.
- `favorite_places`, `collections`, and `collection_items`.
- `place_intelligence` when its owner is approved.

## Migrations

- Use service-local migrations in the owning backend service.
- Do not add `prisma/schema.prisma` to the web app as the platform source of truth.
- Add new Maven modules for newly approved services to the root `pom.xml`.
- Keep one database or schema per owning service where practical.

## Indexes

- `trips(owner_id)`.
- `trips(start_date, end_date)`.
- `itinerary_days(trip_id, day_number)` unique.
- `itinerary_days(trip_id, date)` unique.
- `itinerary_items(itinerary_day_id, sequence)`.
- `places(normalized_name)`, `places(city)`, `places(category)`, and geospatial-friendly latitude/longitude indexes.
- `place_external_references(provider, external_place_id)` unique.
- `place_external_references(place_id, provider)` unique where one reference per provider is expected.
- `favorite_places(user_id, place_id)` unique.
- `collection_items(collection_id, place_id)` unique.

## Transaction Boundaries

- Trip CRUD transactions stay inside `trip-service`.
- Day/item create, update, delete, reorder, and move transactions stay inside the itinerary owner.
- Moving an item between days resequences source and target days in one local transaction.
- Provider matching persistence stays inside `place-service`.
- No distributed database transaction is introduced.

## Data Consistency

- Cross-service references use IDs only.
- Services may synchronously validate referenced IDs through APIs when the user flow needs an immediate answer.
- Later async events may maintain read models or derived summaries.
- Provider enrichment is stale-tolerant and must not block core trip/itinerary/place workflows.

## Migration Risks

- Missing planned services mean implementation will create new service modules or require an approved combined owner.
- Direct web-app Prisma would create a migration path away from the intended platform architecture.
- Provider cache schema must account for TTL, failure metadata, and provider terms.
- Rating summaries need idempotent recalculation/backfill.

## Prohibited Patterns Check

- No cross-service JPA relationships.
- No direct access to another service database.
- No shared domain tables owned by the web app.
- No provider external ID used as the TripSense primary key.
