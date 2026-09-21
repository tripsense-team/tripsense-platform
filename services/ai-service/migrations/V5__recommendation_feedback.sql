CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  artifact_id VARCHAR(36) NOT NULL UNIQUE,
  goal_json JSONB NOT NULL,
  candidates_json JSONB NOT NULL,
  ranking_version VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_recommendation_impressions_owner_created ON recommendation_impressions(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_recommendation_impressions_expiry ON recommendation_impressions(expires_at);

CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id VARCHAR(36) PRIMARY KEY,
  impression_id VARCHAR(36) NOT NULL REFERENCES recommendation_impressions(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(36) NOT NULL,
  candidate_id VARCHAR(200) NOT NULL,
  action VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_recommendation_feedback_owner_key UNIQUE(owner_user_id, idempotency_key),
  CONSTRAINT ck_recommendation_feedback_action CHECK (action IN ('SAVE', 'REJECT', 'MORE_LIKE_THIS'))
);
CREATE INDEX IF NOT EXISTS ix_recommendation_feedback_owner_created ON recommendation_feedback(owner_user_id, created_at DESC);
