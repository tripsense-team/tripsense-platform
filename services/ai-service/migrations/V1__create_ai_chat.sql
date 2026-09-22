CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY, owner_user_id VARCHAR(36) NOT NULL,
  title VARCHAR(160), locale VARCHAR(16), status VARCHAR(20) NOT NULL,
  summary_json JSONB, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_conversations_owner_updated ON conversations(owner_user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY, conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(36) NOT NULL, client_message_id VARCHAR(80), idempotency_key VARCHAR(120), role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL, content_json JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_messages_owner_client UNIQUE(owner_user_id, client_message_id),
  CONSTRAINT uq_messages_owner_idempotency UNIQUE(owner_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS ix_messages_conversation_created ON messages(conversation_id, created_at, id);
CREATE TABLE IF NOT EXISTS runs (
  id VARCHAR(36) PRIMARY KEY, conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(36) NOT NULL, trigger_message_id VARCHAR(36) NOT NULL REFERENCES messages(id),
  assistant_message_id VARCHAR(36) REFERENCES messages(id), action_type VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 0, retry_of_run_id VARCHAR(36), supersedes_run_id VARCHAR(36),
  error_code VARCHAR(80), error_message VARCHAR(500), input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0, estimated_cost_micros INTEGER NOT NULL DEFAULT 0,
  cancel_requested_at TIMESTAMPTZ, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_runs_owner ON runs(owner_user_id, id);
CREATE INDEX IF NOT EXISTS ix_runs_status ON runs(status, created_at);
