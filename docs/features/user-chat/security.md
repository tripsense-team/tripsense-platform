# User Chat Security & Trust Boundaries

## Authentication & Authorization

- All REST endpoints and WebSocket handshakes require valid Bearer JWT tokens.
- **Participant IDOR Prevention**: Every message query or conversation access MUST verify that the authenticated `userId` (extracted from Security Context / JWT) is an active participant in `chat_participants` for that `conversationId`.
- Accessing or posting messages to a conversation where the user is not a participant returns `403 Forbidden`.

## Input Validation & Sanitation

- Message content sanitized against HTML / XSS insertion before rendering in UI.
- Maximum message length restricted (e.g., 2000 characters).
- Rate limiting applied at Gateway for message creation endpoints to prevent spamming.
