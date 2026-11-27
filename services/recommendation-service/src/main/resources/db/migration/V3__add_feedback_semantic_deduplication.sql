ALTER TABLE recommendation_feedback_event
  ADD COLUMN dedup_key VARCHAR(160);

CREATE UNIQUE INDEX uq_recommendation_feedback_user_dedup_key
  ON recommendation_feedback_event (user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
