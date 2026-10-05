# User Chat Implementation Plan

## Phase 1: Database & Backend Domain Models (`services/social-service`)
- Add JPA entities for `Conversation`, `ConversationParticipant`, and `DirectMessage`.
- Create repositories and Liquibase / SQL migrations for chat tables.
- Implement `ChatService`, `ConversationService`, and REST endpoints under `/api/v1/chat`.
- Add IDOR ownership checks ensuring user participation.

## Phase 2: User Service Integration
- Integrate client call to `user-service` to resolve participant names and profile pictures.

## Phase 3: Real-Time WebSocket Channel
- Configure WebSocket STOMP message broker and destination paths in `services/social-service`.
- Expose WebSocket path `/ws-chat` through `services/api-gateway`.

## Phase 4: Web Application (`apps/web/tripsense`)
- Update sidebar navigation layout to include Chat page link.
- Build Chat view layout: conversation list sidebar, user search modal, message thread viewer, and message input box.
- Implement WebSocket client (`@stomp/stompjs` / `sockjs-client`) with REST initial fetch fallback.
