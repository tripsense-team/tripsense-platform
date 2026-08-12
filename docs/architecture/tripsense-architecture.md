# TripSense Architecture

TripSense is organized as a gateway-fronted platform with independently owned service data.

## Expected Platform Components

- API Gateway
- Eureka discovery
- identity-service
- user-service
- trip-service
- place-service
- context-service
- itinerary-service
- review-service
- notification-service
- ai-service
- PostgreSQL
- Redis where low-latency cache or ephemeral state is appropriate
- Kafka where asynchronous communication is appropriate
- FastAPI for AI service implementation

## Current Repository Signals

The source tree currently includes:

- API Gateway: `IMPLEMENTED` at [ApiGateway](../../services/ApiGateway/)
- Discovery server: `IMPLEMENTED` in the working tree at [discovery-server](../../services/discovery-server/)
- Trip service: `IMPLEMENTED` at [TripService](../../services/TripService/)
- Place service: `IMPLEMENTED` at [PlaceService](../../services/PlaceService/)
- Context service: `IMPLEMENTED` at [ContextService](../../services/ContextService/)
- Itinerary service: `IMPLEMENTED` at [ItineraryService](../../services/ItineraryService/)
- Review service: `IMPLEMENTED` at [ReviewService](../../services/ReviewService/)
- Web app: `IMPLEMENTED` at [Web App](../../apps/web/tripsense/)
- Mobile app: `IMPLEMENTED` at [Mobile App](../../apps/mobile/tripsense/)
- identity-service: `PLANNED`, not found in the current source tree.
- user-service: `PLANNED`, not found in the current source tree.
- notification-service: `PLANNED`, not found in the current source tree.
- ai-service: `PLANNED`, not found in the current source tree.

The expected architecture may include services not yet present in the repository. Feature plans must state whether a service already exists or is a proposed future component.

## Integration Principles

- Route public traffic through API Gateway.
- Keep each service responsible for its own database and migrations.
- Exchange IDs, DTOs, and events across service boundaries.
- Prefer deterministic business logic for important user-visible decisions.
- Use AI to assist workflows, not to silently replace enforceable rules.

## Related

- [Service Boundaries](service-boundaries.md)
- [Services](../services/index.md)
- [Domains](../domain/index.md)
- [ADRs](../adr/index.md)
- [Multi-Agent Feature Workflow](../workflows/multi-agent-feature-workflow.md)
- [Feature Index](../features/index.md)
