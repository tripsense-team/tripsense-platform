CREATE TABLE IF NOT EXISTS proposals (
  id VARCHAR(36) PRIMARY KEY,
  owner_user_id VARCHAR(36) NOT NULL,
  conversation_id VARCHAR(36) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  run_id VARCHAR(36) NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  target_trip_id VARCHAR(36) NOT NULL,
  scope VARCHAR(32) NOT NULL,
  processing_state VARCHAR(24),
  business_state VARCHAR(24) NOT NULL,
  payload_version INTEGER NOT NULL,
  payload_json JSONB NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  validation_json JSONB NOT NULL,
  evidence_json JSONB NOT NULL,
  base_trip_revision BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  applied_receipt_json JSONB,
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT ck_proposals_business_state CHECK (business_state IN ('READY','APPLIED','REJECTED','EXPIRED','STALE','INVALID','APPLY_FAILED')),
  CONSTRAINT ck_proposals_processing_state CHECK (processing_state IS NULL OR processing_state IN ('DRAFT','VALIDATING','APPLYING'))
);
CREATE INDEX IF NOT EXISTS ix_proposals_owner_created ON proposals(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_proposals_trip_state ON proposals(owner_user_id, target_trip_id, business_state);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposals_run_ready ON proposals(run_id) WHERE business_state = 'READY';
