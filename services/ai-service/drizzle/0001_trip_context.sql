ALTER TABLE tripsense_ai_v2.chats
  ADD COLUMN IF NOT EXISTS trip_id UUID NULL,
  ADD COLUMN IF NOT EXISTS trip_linked_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ai_v2_chats_user_trip
  ON tripsense_ai_v2.chats(user_id, trip_id)
  WHERE trip_id IS NOT NULL;

ALTER TABLE tripsense_ai_v2.proposals
  ADD COLUMN IF NOT EXISTS proposal_hash VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS applied_trip_id UUID NULL,
  ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NULL;
