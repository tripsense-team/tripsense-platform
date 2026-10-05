CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY,
  user_low_id UUID NOT NULL,
  user_high_id UUID NOT NULL,
  initiated_by UUID NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('DRAFT', 'PENDING', 'ACTIVE', 'DECLINED')),
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
  type VARCHAR(16) NOT NULL CHECK (type IN ('TEXT', 'SHARED_TRIP')),
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
CREATE INDEX chat_blocks_blocked_idx ON chat_blocks (blocked_id, blocker_id);
CREATE TABLE chat_reports (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id),
  reporter_id UUID NOT NULL,
  reported_user_id UUID NOT NULL,
  message_id UUID REFERENCES chat_messages(id),
  reason VARCHAR(32) NOT NULL CHECK (reason IN ('SPAM', 'HARASSMENT', 'DANGEROUS_CONTENT', 'PRIVACY', 'OTHER')),
  details VARCHAR(500),
  status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'DISMISSED', 'ACTIONED')),
  created_at TIMESTAMPTZ NOT NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  decision VARCHAR(24)
);
CREATE UNIQUE INDEX chat_reports_one_pending_idx ON chat_reports (reporter_id, reported_user_id, conversation_id) WHERE status = 'PENDING';
CREATE INDEX chat_reports_queue_idx ON chat_reports (status, created_at, id);
CREATE INDEX chat_reports_reporter_window_idx ON chat_reports (reporter_id, created_at DESC);
CREATE TABLE chat_restrictions (
  user_id UUID PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(500) NOT NULL,
  decided_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE chat_moderation_audits (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES chat_reports(id),
  moderator_id UUID NOT NULL,
  action VARCHAR(24) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
