# User Chat Architectural Decisions

## Decision 1: Service Ownership
- **Decision**: Place direct messaging entities inside `services/social-service` rather than building a brand new microservice.
- **Rationale**: `social-service` already manages social interactions, posts, sharing, and user connections. Placing user chat in `social-service` avoids operational overhead of introducing another microservice while keeping service boundaries clean.

## Decision 2: Cross-Service User Details
- **Decision**: `social-service` stores raw `userId` strings and fetches recipient user profiles (avatar, full name) from `user-service` on API request or via a light REST client / Redis cache.
- **Rationale**: Strict adherence to no cross-service database access and no cross-service JPA entities.

## Decision 3: Delivery Channel
- **Decision**: Support REST fallback for polling / initial load + WebSocket (STOMP/SockJS) for real-time delivery.
- **Rationale**: Ensures reliability on mobile / web networks even if WebSocket connection drops temporarily.
