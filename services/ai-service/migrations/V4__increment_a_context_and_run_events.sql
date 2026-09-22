ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_through_message_id VARCHAR(36);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_source_hash VARCHAR(64);

ALTER TABLE runs ADD COLUMN IF NOT EXISTS execution_profile VARCHAR(32);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS context_sufficiency VARCHAR(32);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS retrieval_sufficiency VARCHAR(32);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS goal_json JSONB;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS counters_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS termination_reason VARCHAR(80);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_token VARCHAR(36);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS conversation_context_facts (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  fact_key VARCHAR(80) NOT NULL,
  value_json JSONB NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_ref VARCHAR(80),
  confidence INTEGER NOT NULL DEFAULT 100,
  scope_type VARCHAR(24) NOT NULL DEFAULT 'CONVERSATION',
  scope_id VARCHAR(80),
  state VARCHAR(24) NOT NULL DEFAULT 'KNOWN',
  sensitivity VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  expires_at TIMESTAMPTZ,
  supersedes_fact_id VARCHAR(36),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_context_facts_conversation_key ON conversation_context_facts(owner_user_id, conversation_id, fact_key, state);
CREATE INDEX IF NOT EXISTS ix_context_facts_scope_key ON conversation_context_facts(owner_user_id, scope_type, scope_id, fact_key);
CREATE INDEX IF NOT EXISTS ix_context_facts_expiry ON conversation_context_facts(expires_at);

CREATE TABLE IF NOT EXISTS pending_clarifications (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  originating_run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  required_keys_json JSONB NOT NULL,
  answer_schema_json JSONB NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
  attempt_number INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pending_clarification_active ON pending_clarifications(owner_user_id, conversation_id, status);

CREATE TABLE IF NOT EXISTS run_events (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  conversation_id VARCHAR(36) NOT NULL,
  sequence INTEGER NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload_json JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_run_events_sequence UNIQUE(run_id, sequence)
);
CREATE INDEX IF NOT EXISTS ix_run_events_replay ON run_events(run_id, sequence);

CREATE TABLE IF NOT EXISTS model_calls (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(80) NOT NULL,
  model VARCHAR(120) NOT NULL,
  prompt_version VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  usage_source VARCHAR(20) NOT NULL DEFAULT 'ESTIMATED',
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_model_calls_run ON model_calls(run_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_run_leases (
  conversation_id VARCHAR(36) PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  run_id VARCHAR(36) NOT NULL,
  lease_token VARCHAR(36) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
