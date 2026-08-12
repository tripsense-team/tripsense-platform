# API

## Endpoints

No domain endpoints are added or changed.

Gateway route prefixes should be standardized for implemented services:

| Gateway Path | Target Service |
| --- | --- |
| `/api/trips/**` | `lb://trip-service` |
| `/api/places/**` | `lb://place-service` |
| `/api/context/**` | `lb://context-service` |
| `/api/itineraries/**` | `lb://itinerary-service` |
| `/api/reviews/**` | `lb://review-service` |

The Eureka dashboard remains available locally at `http://localhost:8761/`.

## Request DTOs

No DTO changes.

## Response DTOs

No DTO changes.

## Validation

No domain validation changes.

## Error Cases

- Gateway should return standard upstream unavailable behavior if a registered service is down.
- Discovery server should not register itself as a Eureka client.

## Backward Compatibility

Existing direct service URLs may change if ports are currently implicit. Local developer documentation should point users to Gateway where possible.

## Service Calls

Gateway to services uses Spring Cloud Gateway with Eureka-backed `lb://` service IDs. Domain services register with Eureka but do not add new service-to-service calls.
