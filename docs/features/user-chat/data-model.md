# User Chat Data Model

Owned by `services/social-service` database (`social_db`).

## Tables & Entities

### `chat_conversations`
- `id` (VARCHAR(36), PK): UUID of conversation.
- `created_at` (TIMESTAMP): Creation timestamp.
- `updated_at` (TIMESTAMP): Last message or activity timestamp.

### `chat_participants`
- `id` (VARCHAR(36), PK): Participant mapping ID.
- `conversation_id` (VARCHAR(36), FK -> `chat_conversations.id`): Conversation link.
- `user_id` (VARCHAR(36), NOT NULL): Platform user ID.
- `last_read_at` (TIMESTAMP): Timestamp when user last read messages in this conversation.
- Unique Index: `(conversation_id, user_id)`

### `chat_messages`
- `id` (VARCHAR(36), PK): Message UUID.
- `conversation_id` (VARCHAR(36), FK -> `chat_conversations.id`): Conversation link.
- `sender_id` (VARCHAR(36), NOT NULL): User ID of sender.
- `content` (TEXT, NOT NULL): Text body.
- `created_at` (TIMESTAMP): Sent timestamp.
- Index: `(conversation_id, created_at DESC)`

## Schema Design Rules
- Direct references to `user_id` are plain string UUID fields without JPA `@ManyToOne` cross-service relationships.
