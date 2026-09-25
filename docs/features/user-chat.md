# User Direct Messaging — Production Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/social-service` (existing)
- **Affected Components**: `apps/web/tripsense`, `services/social-service`, `services/user-service`, `services/api-gateway`, local Redis configuration
- **Created Date**: 2026-09-24
- **Replaces for future work**: [legacy `user-chat` plan](./user-chat/index.md). Its `IMPLEMENTING` label describes the UI prototype, not a completed messaging backend. This file is the production source of truth; the legacy files remain historical references.
- **Related UI**: `/chat`, currently backed by `mock-chat-service.ts` and process-memory demo conversations

---

## 1. Goal & Requirements

### 1.1 Goal and verified starting point

Turn the existing split-view chat prototype into persistent, authenticated one-to-one messaging between real TripSense accounts. A sent message survives refresh and sign-in on another device. Recipients receive updates without refreshing, and can manage message requests, read state, mute, block, and report.

Current repository evidence:

- `/chat` and the user sidebar entry exist. `UserChatWorkspace` reads and writes `mockChatService`; the sample users and messages are hardcoded in memory.
- `social-service` exists, owns social interactions and a PostgreSQL database, but has no chat tables, controller, or realtime transport.
- Gateway already routes `/api/social/**` to `social-service`; it has no chat-specific streaming policy.
- `user-service` exposes public profile by ID/batch, but has no searchable public-user endpoint. The approved profile DTO contains `userId`, `displayName`, and `avatarUrl` only.
- Redis is in `docker-compose.yml`; no notification service is checked in. There is no chat Kafka infrastructure to assume.
- The prototype contains request, mute, block, report, retry, online, and shared-trip controls. Report is currently a dialog with no submission. The simulated offline/failure/reset controls are demo-only.

### 1.2 User flows

1. An authenticated user opens `/chat`; the UI loads the conversation list, request count, unread count, and the selected thread through Gateway REST. No demo data appears in production.
2. The user selects **New conversation**, searches enabled accounts by public display name (minimum two characters), and opens the existing direct thread or an empty sender-only draft. No account email is exposed.
3. The user sends a text message or an already-published public TripSense trip-share card. The client shows `sending`, submits once with a stable `clientMessageId`, then replaces it with the server message. A transport failure retains the draft and offers retry with the same ID.
4. For a first contact, the recipient sees one pending request and its first message. The sender cannot send another message until the recipient accepts. The recipient explicitly accepts or declines; decline hides the thread for the recipient and prevents immediate repeat requests.
5. An active thread supports history pagination, unread badges, delivered/read cursors, incoming realtime updates, mute, and profile navigation. Opening a visible thread advances the read cursor; merely receiving an event does not.
6. A user may block/unblock an account and report a conversation/message. Blocking denies new messages in both directions and removes that thread from the normal inbox; report creates a moderator-reviewable case with limited evidence.
7. After a disconnect, the UI shows connection state, reconnects, and refreshes list plus active thread from REST. Logging out closes the stream and clears all chat state.

### 1.3 Scope

| In scope | Out of scope for this release |
| --- | --- |
| 1:1 text messaging, published public trip-share card, request/accept/decline, inbox search/filter, unread count, mute, block/unblock, report/moderation, presence indicator, realtime + recovery, responsive web UI, EN/VI copy | Group chat, arbitrary files/images/voice/video, typing indicator, message edit/delete/unsend, reactions, E2EE, email/mobile push, AI assistant chat migration, private trip sharing, cross-platform mobile UI |

The existing AI Planner conversation domain stays separate from user-to-user chat. The trip card refers to a published social trip-share post, never a private trip ID or private itinerary.

### 1.4 Domain invariants and acceptance criteria

- [ ] Only enabled, authenticated accounts can access chat; every read/write verifies current participation or report/moderator authority. Caller identity comes from verified JWT, never request body.
- [ ] A pair of users has at most one direct conversation under concurrent create requests; self-chat and chat with nonexistent/disabled users fail.
- [ ] Recipient sees no empty draft. Exactly one first message creates a pending request. Sender cannot send another until accepted; recipient cannot reply before accepting.
- [ ] Text is trimmed, 1–2000 Unicode characters, rendered as plain text. Only supported `TEXT` or `SHARED_TRIP` payloads are accepted.
- [ ] Repeating a send with the same `(senderId, clientMessageId)` returns the original message and never increments unread twice.
- [ ] List and history use stable cursor pagination. Unread and read/delivered status are computed from monotonic server sequences, not client clocks.
- [ ] Both sides see a new message within the target of 2 seconds when the realtime connection is healthy; reconnect or polling restores every persisted message.
- [ ] Decline, block, and report persist across reload/devices. Mute affects the muting participant only. A blocked user cannot send via direct REST calls.
- [ ] Shared-trip preview is accepted only for an owned, currently public and published `social_trip_shares` post. Removed/unpublished posts later render an unavailable card without exposing private content.
- [ ] User search reveals only `userId`, public display name and avatar, excludes self, and does not expose email or account existence outside authenticated search.
- [ ] Mobile list/thread navigation, empty/loading/error/offline states, keyboard operation, and English/Vietnamese text remain usable; demo controls and sample users are removed from production.
- [ ] Tests cover concurrency, IDOR, idempotency, request lifecycle, block/report, stream recovery, and UI transitions; backend/web builds pass.

---

## 2. Architecture & Service Boundaries

```text
Browser /chat
  | REST + authenticated fetch-stream (SSE)
  v
API Gateway /api/social/chat/**
  | routes to existing lb://social-service; no new public service
  v
social-service ---- PostgreSQL social_db (conversation, participants, messages, blocks, reports)
  |                    |
  | REST (bounded)     +-- commit -> Redis pub/sub event invalidation -> SSE to target user
  v
user-service public display-name search + allowlisted public profile lookup
```

| Component | Responsibility and boundary |
| --- | --- |
| Web | UI state, optimistic send, cursor pages, SSE reconnection, safe feedback. Uses `apiClient` for JSON and the existing authenticated fetch/refresh path for SSE. No direct service URL. |
| Gateway | Reuses `/api/social/**` route; sets `Cache-Control: no-store` and disables buffering for chat stream, enforces a dedicated user/IP message-create rate limit (enabled by default) without imposing it on the SSE connection. |
| Social service | Sole owner of direct-chat state and authorization. Validates identities through existing JWT and user-service profile contract. Persists before emitting change notifications. |
| User service | Adds bounded, authenticated public display-name search of enabled users. Returns only public profile fields; no email search. |
| Redis | Cross-instance SSE fan-out and short-lived presence TTL. Not source of truth; PostgreSQL remains authoritative. |

**Realtime choice:** HTTP REST writes plus Server-Sent Events read stream. The existing Spring MVC service can implement `SseEmitter`; browser fetch supports the required Bearer header, unlike native `EventSource`. The stream carries only `{conversationId, eventType, version}`, never message text or token. Clients fetch authorized DTOs via REST. Open streams end after at most five minutes and reconnect with a fresh/refreshable JWT. Redis pub/sub is non-durable; the client reconciles from REST on reconnect, browser focus, and a bounded background interval (30 seconds). Redis outage cannot make REST writes appear successful without database commit. No Kafka topic is required for this release; notification/push integration requires a later approved plan.

**Availability:** User-profile search/validation failure returns a retryable `503`; do not create a thread for an unverified target. The web cache may display the last safely fetched public profile while user-service is briefly unavailable, but social-service does not copy profile fields into chat tables. Initial SSE failure falls back to REST polling.

The internal search contract is `GET /api/users/public-profiles/search?query={prefix}&limit={1..20}` with the caller's Bearer JWT forwarded by social-service. In `user-service`, match this route as authenticated before the existing public `/api/users/public-profiles/**` rule. The browser uses the social-service chat search endpoint, which also filters self and blocked pairs.

---

## 3. API & Event Contracts

All public endpoints below are under Gateway `/api/social/chat`, require Bearer JWT, and use the existing `ApiResponse<T>` envelope for JSON. Cursor limits: default 20, maximum 50. `400` invalid payload, `401` unauthenticated, `403` nonparticipant/blocked, `404` unknown resource, `409` invalid request state, `429` rate limited, `503` dependency unavailable. Do not include raw exception messages in responses.

| Method | Path | Contract |
| --- | --- | --- |
| `GET` | `/users?query={2..50 chars}&limit=10` | Public account search (`userId`, `displayName`, `avatarUrl`), excluding self/blocked pairs; bounded and rate limited. |
| `GET` | `/conversations?filter=all\|unread\|requests&cursor=&limit=20` | Direct threads in descending `(lastMessageSeq,id)` order; sender drafts visible only to sender. Includes peer snapshot, request state, last message snippet, unread count, mute, presence. |
| `POST` | `/conversations` | `{ "recipientId": "uuid" }`; get-or-create pair. `200` existing, `201` sender-only draft. |
| `GET` | `/conversations/{id}/messages?beforeSeq=&limit=30` | Older messages, newest first with `nextBeforeSeq`, client reverses for display. Participant only. |
| `POST` | `/conversations/{id}/messages` | Idempotent send; see request/response below. `201` new, `200` identical retry. |
| `PUT` | `/conversations/{id}/delivered` | `{ "throughSeq": "123" }`; max monotonic receipt after client fetches messages. |
| `PUT` | `/conversations/{id}/read` | `{ "throughSeq": "123" }`; max monotonic read cursor only when thread is visible/focused. Also advances delivered through the same sequence. |
| `POST` | `/conversations/{id}/accept` | Pending recipient only; activates thread. |
| `POST` | `/conversations/{id}/decline` | Pending recipient only; marks declined and hides recipient inbox entry. Re-request unavailable for 30 days; policy enforced server-side. |
| `PUT` | `/conversations/{id}/mute` | `{ "muted": true }`; participant-specific, idempotent. |
| `POST` | `/blocks` | `{ "targetUserId": "uuid" }`; idempotent global chat block for this pair. |
| `DELETE` | `/blocks/{targetUserId}` | Unblock; does not automatically accept an old request. |
| `GET` | `/blocks?cursor=&limit=20` | Manage blocked accounts in Chat settings. |
| `POST` | `/conversations/{id}/reports` | `{ "reportedUserId": "uuid", "messageId": "uuid?", "reason": "SPAM|HARASSMENT|DANGEROUS_CONTENT|PRIVACY|OTHER", "details": "<=500?" }`; `201` report receipt. |
| `GET` | `/events` | Authenticated `text/event-stream`; `chat.changed`, `chat.presence`, heartbeat events. No user-supplied subscription target. |
| `GET` | `/moderation/chat-reports?status=PENDING&cursor=&limit=20` | Moderator/Admin only; case metadata and limited evidence. |
| `POST` | `/moderation/chat-reports/{reportId}/decision` | Moderator/Admin; `DISMISS` or time-bounded `RESTRICT_CHAT` with audited reason. |

Example send:

```json
{
  "clientMessageId": "3ee180ed-e98a-4dae-9549-013460592d2a",
  "type": "TEXT",
  "text": "Mình thấy chuyến đi Hội An của bạn rất hay!"
}
```

For trip sharing: `{"clientMessageId":"uuid","type":"SHARED_TRIP","sharedPostId":"uuid"}`. Server rejects mixed text/trip payloads and verifies ownership, public visibility, current publication, and not removed. A message response contains `id`, `clientMessageId`, `conversationId`, `seq` (decimal string for JavaScript safety), `senderId`, `type`, `text` or allowlisted trip card, `createdAt`, and `status`. Conversation response includes `id`, `peer`, `state` (`DRAFT|PENDING|ACTIVE|DECLINED`), `requestDirection`, `lastMessage`, `unreadCount`, `muted`, `updatedAt`, and `online`. Presence has a coarse `online/offline` label; the old mock's exact "3 hours ago" text is not shown without a reliable persisted timestamp. User-entered time is never trusted. `sent` means committed to DB; `delivered` means the peer acknowledged fetching through that sequence; `read` means explicit visible-thread read cursor.

Moderator decision body: `{"action":"RESTRICT_CHAT","durationHours":24,"reason":"Repeated harassment"}` (duration allowed: 1–720 hours), or `{"action":"DISMISS","reason":"Insufficient evidence"}`. Decisions are once-only; a second decision returns `409`.

SSE format (private per authenticated user; `id` is an ephemeral event ID, not a durable replay cursor):

```text
event: chat.changed
data: {"conversationId":"uuid","eventType":"MESSAGE_CREATED","version":"123"}

event: chat.presence
data: {"userId":"uuid","online":true}
```

The client treats SSE as an invalidation hint and refreshes authorized REST data. Stream timeout, Redis outage, or missed event cannot erase committed data. The gateway must pass through SSE, set `X-Accel-Buffering: no`, and avoid caching/short response timeout. Backend must authenticate before opening stream and cap connections per user.

---

## 4. Data Model & Migrations

Flyway migration in `services/social-service/src/main/resources/db/migration/`, additive and owned solely by social DB. Use UUID user references without cross-service foreign keys/JPA entities. The following is a schema contract; implementation chooses the next valid Flyway version after inspecting current migrations.

```sql
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY,
  user_low_id UUID NOT NULL,
  user_high_id UUID NOT NULL,
  initiated_by UUID NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT','PENDING','ACTIVE','DECLINED')),
  version BIGINT NOT NULL DEFAULT 0,
  last_message_seq BIGINT,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT chat_pair_order CHECK (user_low_id < user_high_id),
  CONSTRAINT chat_pair_unique UNIQUE (user_low_id, user_high_id)
);
CREATE TABLE chat_participants (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  user_id UUID NOT NULL,
  last_delivered_seq BIGINT NOT NULL DEFAULT 0,
  last_read_seq BIGINT NOT NULL DEFAULT 0,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT chat_receipt_order CHECK (last_delivered_seq >= last_read_seq)
);
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  seq BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  sender_id UUID NOT NULL,
  client_message_id UUID NOT NULL,
  type VARCHAR(16) NOT NULL CHECK (type IN ('TEXT','SHARED_TRIP')),
  text TEXT,
  shared_post_id UUID,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT chat_message_payload CHECK (
    (type = 'TEXT' AND text IS NOT NULL AND char_length(text) BETWEEN 1 AND 2000 AND shared_post_id IS NULL)
    OR (type = 'SHARED_TRIP' AND text IS NULL AND shared_post_id IS NOT NULL)
  ),
  CONSTRAINT chat_sender_idempotency UNIQUE (sender_id, client_message_id)
);
CREATE INDEX chat_messages_thread_cursor_idx ON chat_messages (conversation_id, seq DESC);
CREATE INDEX chat_conversations_low_inbox_idx ON chat_conversations (user_low_id, last_message_seq DESC NULLS LAST, id);
CREATE INDEX chat_conversations_high_inbox_idx ON chat_conversations (user_high_id, last_message_seq DESC NULLS LAST, id);
CREATE TABLE chat_blocks (
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chat_no_self_block CHECK (blocker_id <> blocked_id)
);
CREATE TABLE chat_reports (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  message_id UUID REFERENCES chat_messages(id),
  reason VARCHAR(32) NOT NULL,
  details VARCHAR(500),
  status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING','DISMISSED','ACTIONED')),
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  decision VARCHAR(24)
);
CREATE INDEX chat_reports_queue_idx ON chat_reports (status, created_at, id);
CREATE INDEX chat_reports_reporter_window_idx ON chat_reports (reporter_id, created_at DESC);
CREATE TABLE chat_restrictions (
  user_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(500) NOT NULL,
  decided_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

In `user-service`, add an index for case-insensitive public display-name prefix search, for example `CREATE INDEX ... ON user_profiles (lower(display_name) text_pattern_ops) WHERE display_name IS NOT NULL;`; join its own `users` table to filter enabled accounts. Reject empty/one-character and wildcard-only queries, cap results, and do not search private email. Chat reports enforce one active case per `(reporter_id, reported_user_id, conversation_id)` plus a per-hour throttle. A moderator action creates an immutable audit row (following the existing social audit pattern without making `social_reports.post_id` nullable). `RESTRICT_CHAT` sets a finite expiry in `chat_restrictions`, checked on send and conversation creation; it does not change user-service login status. Authorize and cap moderator evidence to the reported message plus at most two adjacent messages. If `messageId` is absent, the server selects the latest message sent by the reported user in that conversation; reject a report if no such message exists. Store no arbitrary conversation export.

**Transaction rules:** pair creation uses the unique pair constraint; one DB transaction validates participant/state/block/restriction, inserts message, advances `last_message_seq` and `version`, and changes `DRAFT` to `PENDING` on first send. Lock the conversation row or use optimistic retry to enforce the one-message pending rule under concurrent sends. Receipt updates clamp `throughSeq` to a committed message in that conversation and never decrease. Block and send take the same deterministic transaction-scoped lock for the unordered user pair before checking/inserting block state, so no send commits after a committed block. Redis publish occurs after commit. `version` increments for every conversation-visible change, including request, mute, and receipt transitions; it is the SSE invalidation version, not a pagination cursor.

**Migration/rollback:** additive tables only; no backfill from demo data (it is fictitious). Deploy backend schema and endpoints before switching web. Roll back application version while leaving unused chat tables intact; removal would require a separately approved data-retention operation. Establish a retention/deletion policy before production launch; no automatic deletion in this release.

---

## 5. Security, Privacy, and Trust Boundaries

| Area | Required behavior |
| --- | --- |
| Authentication | Social-service explicitly matches `/api/social/chat/**` before its current public-GET rule, requiring JWT for every method including SSE. User-service search requires JWT. Gateway forwards Authorization; backend independently verifies token. |
| IDOR | Check active participant on every conversation/message/receipt/request/report operation; only the pending recipient may accept/decline. Avoid leaking whether an unrelated conversation exists. |
| Blocking | Deny sends/starts when either direction is blocked; conceal the blocked user's presence/search result where practical. Do not rely on disabled UI controls. |
| Input and XSS | Bean validation plus DB constraints; render message body as plain text, never raw HTML/Markdown. Reject control characters except permitted line breaks, trim text, cap query/size/connection counts. |
| Public profiles | Search enabled users by display name only; return allowlisted public fields. No email/phone lookup or arbitrary user enumeration endpoint. |
| Trip privacy | Validate public published trip-share ownership in social DB at send and current visibility at read; never emit private trip ID, unpublished itinerary, or preview of removed content. |
| Realtime | Subscribe only the authenticated user; no target user ID from client. No bearer tokens in URL, Redis payload, logs, or event data. Enforce same-origin/CORS, short stream lease and bounded reconnect/heartbeat. |
| Moderation | Reported case exposes only scoped evidence to `MODERATOR`/`ADMIN`; decision audited. Rate limit reports. Blocking is not a substitute for a report. |
| Web feedback | Use `apiClient`, sanitized user-facing errors, inline send/retry state, no fake success or silent mock fallback. Clear in-memory state on logout/account switch. |

---

## 6. Failure Modes, Trade-offs, and Rejected Alternatives

| Scenario | Decision |
| --- | --- |
| User sends twice due to timeout/retry | Client reuses `clientMessageId`; DB unique key returns canonical message. Different payload with same key returns `409`. |
| Recipient offline or SSE disconnected | Database commit is success. Receiver catches up through REST when online; periodic reconciliation covers missed Redis events. |
| Two first messages race | Conversation row lock plus state check admits one first message until accepted. |
| Multiple social-service replicas | Redis pub/sub delivers invalidation to the replica hosting each SSE connection. Redis TTL tracks active connections; presence is advisory and may briefly lag. |
| Token expires during stream | Five-minute lease ends; authenticated fetch refreshes and reconnects. Explicit logout closes local stream. |
| User service slow | New target validation/search returns retryable failure; existing thread content remains available with last safe public snapshot. |
| Declined requests | No repeat request for 30 days; a later new first message may reopen the existing pair after cooldown. Block always overrides this. |
| Report privacy | Use a dedicated chat report table and limited moderator evidence; existing `social_reports` requires `post_id` and is unsuitable without a wider migration. |
| STOMP/SockJS | Deferred: adds broker/session authentication and gateway upgrade complexity to the current MVC stack; REST + SSE fulfills this one-to-one use case. |
| New messaging microservice | Rejected: existing social-service already owns social interactions and its own DB. |
| Kafka notification event | Deferred until an approved notification consumer exists; Redis is only transient fan-out, not a business-event contract. |
| Browser localStorage message queue | Rejected for private content persistence/XSS exposure; keep optimistic pending message in memory and server idempotency for active retries. |

---

## 7. Phased Implementation & Verification

### Phase A — Persistence and core rules (`social-service`)

- [x] Flyway migration, entities/repositories and indexes; pair uniqueness, message idempotency, state machine, read/delivery cursors, block and report model.
- [x] Domain tests: concurrent get-or-create, concurrent first sends, same-key retry/different-key conflict, unauthorized user, read monotonicity, block race, decline cooldown.

### Phase B — REST and cross-service contracts

- [x] Controllers/DTOs/error codes. Add authenticated public-display-name search in `user-service`, bounded query and index; reuse public profile DTO.
- [x] Update `social-service` security matcher ordering. Validate recipient status and trip-share publication/ownership. Implement chat report + moderator decision/audit.
- [x] Gateway dedicated chat write/search throttle and stream response headers. Contract/integration tests via Gateway and direct service.

### Phase C — Realtime and recovery

- [x] Add Redis pub/sub fan-out, per-user SSE connections, bounded heartbeat/lease/presence TTL, after-commit publication and cleanup.
- [x] Test two social-service instances, reconnect after missed events, token expiry, Redis interruption, duplicate/out-of-order invalidations.

### Phase D — Web integration

- [x] Replace `mock-chat-service` in `/chat` with typed API repository and query cache; preserve the current full-bleed desktop/mobile layout.
- [x] Wire user search, draft/first message, request accept/decline, text send/retry, history cursors, unread and receipt updates, mute, block/unblock, report, published trip card, profile link and presence.
- [x] Remove demo notice and simulated offline/failure/reset controls from production route. Add blocked-account management UI, safe empty/error/offline states, and EN/VI keys with parity.
- [x] Connect SSE via authenticated fetch, refresh/reconcile on reconnect/focus and 30-second fallback polling. Clear all chat caches and stream on logout.

### Phase E — Verification and rollout

- [x] Backend unit/integration tests with PostgreSQL and Redis; security tests for anonymous, participant IDOR, blocked user, nonmoderator report access, and spoofed trip card.
- [x] Web tests for pending/failed/retry/read/request/block transitions and responsive keyboard flow. Manual two-account/two-browser check: send, reconnect, refresh, report, block, EN/VI, mobile.
- [x] Run `./mvnw -pl services/social-service,services/user-service,services/api-gateway -am test` from repo root, then `npm run type-check`, `npm run lint`, `npm run i18n:check`, `npm test`, `npm run build` in `apps/web/tripsense`.
- [x] Release behind a web feature flag. Enable after migrations and Gateway headers/rate limits are live; no synthetic conversations in production. Monitor send latency, SSE disconnects, 4xx/5xx, and duplicate-key conflict rate without logging message content.

## Human Approval Gate

The user explicitly approved implementation on 2026-09-24 by requesting “Hãy tiến hành Implements”. Implementation completed on 2026-09-25.

```text
STATUS: DONE
```
