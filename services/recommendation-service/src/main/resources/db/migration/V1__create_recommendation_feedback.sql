CREATE TABLE recommendation_impression (
  recommendation_id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  trip_id UUID,
  session_id VARCHAR(128),
  query_hash VARCHAR(64),
  retrieval_version VARCHAR(80) NOT NULL,
  fusion_version VARCHAR(80) NOT NULL,
  embedding_version VARCHAR(120) NOT NULL,
  feature_version VARCHAR(80) NOT NULL,
  ranking_version VARCHAR(80) NOT NULL,
  diversity_version VARCHAR(80) NOT NULL,
  degradation_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_recommendation_impression_user_created
  ON recommendation_impression (user_id, created_at DESC);

CREATE TABLE recommendation_impression_item (
  recommendation_id UUID NOT NULL REFERENCES recommendation_impression(recommendation_id) ON DELETE CASCADE,
  place_id VARCHAR(200) NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  final_score DOUBLE PRECISION NOT NULL,
  source_evidence JSONB NOT NULL,
  feature_snapshot JSONB NOT NULL,
  reason_codes JSONB NOT NULL,
  PRIMARY KEY (recommendation_id, place_id),
  UNIQUE (recommendation_id, position)
);

CREATE TABLE recommendation_feedback_event (
  event_id UUID PRIMARY KEY,
  idempotency_key UUID NOT NULL,
  recommendation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  trip_id UUID,
  session_id VARCHAR(128),
  place_id VARCHAR(200) NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  position INTEGER NOT NULL CHECK (position > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  ranking_version VARCHAR(80) NOT NULL,
  feature_version VARCHAR(80) NOT NULL,
  UNIQUE (user_id, idempotency_key),
  FOREIGN KEY (recommendation_id, place_id)
    REFERENCES recommendation_impression_item(recommendation_id, place_id)
);

CREATE INDEX idx_feedback_user_occurred
  ON recommendation_feedback_event (user_id, occurred_at DESC);
CREATE INDEX idx_feedback_place_occurred
  ON recommendation_feedback_event (place_id, occurred_at DESC);

CREATE TABLE recommendation_outbox (
  event_id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ
);
