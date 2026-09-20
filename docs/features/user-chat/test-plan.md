# User Chat Test Plan

## Unit Tests
- `ConversationServiceTest`: Test creation of 1-on-1 conversation, prevent duplicate conversations between same two users.
- `ChatServiceTest`: Test sending message, IDOR authorization rejection when non-participant tries to access messages.
- `MessageUnreadCountTest`: Test unread counter increments and resets upon marking conversation read.

## Integration & API Gateway Tests
- Test REST endpoint access via Gateway with JWT claims.
- Verify non-authenticated request returns `401 Unauthorized`.
- Verify participant authorization returns `403 Forbidden` for non-participants.

## Web UI Tests
- Test rendering conversation list and opening message window.
- Test sending message updates message thread dynamically.
