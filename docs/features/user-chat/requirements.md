# User Chat Requirements

## User Goals

- Allow users to access a dedicated Chat section in the web dashboard navigation.
- Search for and select other registered TripSense users to initiate 1-on-1 private messaging conversations.
- Send, receive, and view real-time or polling-updated direct text messages with timestamps and read states.
- View active conversation list showing latest message snippet, unread message count, and contact profile details.

## Scope

### In-Scope
- 1-on-1 direct messaging between authenticated TripSense users.
- Conversation list sidebar with user search and recent conversation sorting (by last message timestamp).
- WebSocket (STOMP/SockJS via Gateway) or SSE fallback with REST endpoints for message history pagination and sending.
- Message status indicators: sent, delivered, read.
- Integration into `apps/web/tripsense` dashboard route `/chat` and side navigation.

### Out-of-Scope (Phase 1)
- Group chat channels (reserved for future trip collaboration phase).
- Rich media attachments (images/video files in chat) - plain text and trip link previews only for V1.
- End-to-end encryption.

## Acceptance Criteria

1. Dashboard sidebar navigation includes a visible "Messages / Chat" item linking to `/chat`.
2. Accessing `/chat` presents a split view: Conversation List (left) and Message Thread (right).
3. User can click "New Chat" and search for other users by username or email.
4. Selecting a user opens an existing conversation or creates a new conversation draft thread.
5. Sending a message instantly appends it to the active conversation and pushes to the recipient if connected.
6. Unread badge count is displayed on the sidebar chat icon and within conversation list items.
