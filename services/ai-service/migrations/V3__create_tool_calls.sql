CREATE TABLE IF NOT EXISTS tool_calls (
  id VARCHAR(36) PRIMARY KEY,
  run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(36) NOT NULL,
  tool_name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  provenance_json JSONB,
  error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tool_calls_run ON tool_calls(run_id, created_at);
