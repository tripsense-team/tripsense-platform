# Data Model

## Owning Service

No business service owns new data for this setup. Eureka owns runtime service registry metadata in memory.

## Schema Changes

None.

## Migrations

None.

## Indexes

None.

## Transaction Boundaries

No transactional behavior changes.

## Data Consistency

No cross-service data consistency changes. Discovery registration is eventually visible to Gateway through Eureka.

## Migration Risks

- Local scripts, IDE run configurations, or documentation may reference old ports or PascalCase service names.
- Generated `target/` resources may become stale after source configuration changes until services are rebuilt.

## Prohibited Patterns Check

- No cross-service JPA relationships.
- No direct access to another service database.
