# User Chat Architecture

## Component Overview

- **Web Application (`apps/web/tripsense`)**: Renders Chat UI page at `/chat`, handles active conversation state, WebSocket connection, message history fetching, and user lookup.
- **API Gateway (`services/api-gateway`)**: Routes REST HTTP requests (`/api/v1/chat/**`) and WebSocket endpoint (`/ws-chat/**`) to backend services with JWT authentication header validation.
- **Social & Messaging Service (`services/social-service`)**: Owns direct messaging domain entities (`Conversation`, `DirectMessage`, `ConversationParticipant`). Handles conversation management, message persistence, unread tracking, and STOMP message broadcasting.
- **User Service (`services/user-service`)**: Provides user lookup endpoint for participant search and profile details (avatar, full name).

## Communication Pattern

- **HTTP REST**: Fetching paginated conversation list (`GET /api/v1/chat/conversations`), message thread history (`GET /api/v1/chat/conversations/{id}/messages`), and starting new conversation (`POST /api/v1/chat/conversations`).
- **WebSocket / STOMP**: Real-time message exchange on `/user/queue/messages` and conversation status updates.
- **Service Integration**: Synchronous REST call via Spring `RestTemplate` / `WebClient` or Feign from `social-service` to `user-service` to enrich participant profile details by `userId`.

## Architecture Boundaries

- `social-service` owns chat messaging tables. It stores participant `userId` references without cross-service foreign keys or JPA relations to user entity tables.
- `user-service` remains owner of user profile data.
