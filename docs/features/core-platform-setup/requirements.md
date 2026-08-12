# Requirements

## User Goal

Make the TripSense core backend setup coherent by standardizing API Gateway, adding or completing the discovery server, renaming services to project conventions, and assigning consistent ports.

## Use Cases

- A developer can start Eureka discovery, API Gateway, and domain services locally with predictable names and ports.
- Public traffic enters through API Gateway.
- Gateway routes can discover backend services through Eureka.
- Service names match the TripSense documentation and future service contracts.

## Acceptance Criteria

- API Gateway is configured as `api-gateway` on port `8080`.
- Discovery server is a working Spring Cloud Eureka server named `discovery-server` on port `8761`.
- Implemented Spring services use kebab-case application names:
  - `trip-service`
  - `place-service`
  - `context-service`
  - `itinerary-service`
  - `review-service`
- Implemented services register with Eureka at `http://localhost:8761/eureka/`.
- Local service ports are assigned consistently and documented.
- Gateway routes target service IDs through discovery/load-balancer URIs where appropriate.
- Maven artifact names and project names are aligned with service naming.
- Generated build outputs and IDE-only files are not treated as source of truth.

## Business Rules

- Public HTTP access to backend services should go through API Gateway.
- Service boundaries remain unchanged; this setup does not move domain ownership.
- Discovery is infrastructure only and does not own business data.

## Edge Cases

- If a planned service is not present in the source tree, document its reserved name and optional port without creating placeholder application code.
- If a service already has generated files under `target/`, do not edit those files directly.
- If any existing local port conflicts with a standard port, prefer the documented TripSense convention and note the migration.

## Out Of Scope

- Implementing identity, user, notification, or AI services.
- Adding authentication or authorization behavior to Gateway.
- Adding databases, migrations, Kafka topics, or Redis configuration.
- Changing domain APIs or persistence models.

## Open Questions

- Should service folders be renamed from PascalCase to kebab-case in the filesystem, or should only Maven/application metadata be renamed first?
- Should planned services reserve ports now even before source code exists?
