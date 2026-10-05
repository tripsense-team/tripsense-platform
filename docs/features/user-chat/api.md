# User Chat API Specification

## REST Endpoints (Routed through API Gateway `/api/v1/chat`)

### 1. List User Conversations
`GET /api/v1/chat/conversations?page=0&size=20`
- Headers: `Authorization: Bearer <token>`
- Response: `200 OK`
```json
{
  "content": [
    {
      "id": "conv-123",
      "recipient": {
        "userId": "usr-456",
        "fullName": "Alice Smith",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "lastMessage": {
        "id": "msg-789",
        "senderId": "usr-456",
        "content": "Hey, let's plan the Da Nang trip!",
        "createdAt": "2026-09-17T22:00:00Z"
      },
      "unreadCount": 2,
      "updatedAt": "2026-09-17T22:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1
}
```

### 2. Create or Get 1-on-1 Conversation
`POST /api/v1/chat/conversations`
- Headers: `Authorization: Bearer <token>`
- Body:
```json
{
  "recipientId": "usr-456"
}
```
- Response: `200 OK` or `201 Created` returning `ConversationResponse`.

### 3. Fetch Message History
`GET /api/v1/chat/conversations/{conversationId}/messages?page=0&size=30`
- Headers: `Authorization: Bearer <token>`
- Response: `200 OK` returning paginated list of `DirectMessageResponse`.

### 4. Send Direct Message (REST Fallback / Standard Endpoint)
`POST /api/v1/chat/conversations/{conversationId}/messages`
- Body:
```json
{
  "content": "Hello there!"
}
```
- Response: `201 Created` returning `DirectMessageResponse`.

### 5. Mark Messages as Read
`PUT /api/v1/chat/conversations/{conversationId}/read`
- Response: `200 OK` with updated unread counts.

## Real-Time WebSocket (STOMP)

- Endpoint: `/ws-chat`
- Destination: `/app/chat.sendMessage`
- Subscription: `/user/queue/messages`
