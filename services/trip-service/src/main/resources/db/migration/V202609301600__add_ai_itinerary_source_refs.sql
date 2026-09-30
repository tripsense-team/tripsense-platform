ALTER TABLE itinerary_items
  ADD COLUMN IF NOT EXISTS source_kind VARCHAR(30) NULL,
  ADD COLUMN IF NOT EXISTS source_proposal_id UUID NULL,
  ADD COLUMN IF NOT EXISTS source_item_key UUID NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_itinerary_ai_source
  ON itinerary_items(trip_id, source_proposal_id, source_item_key)
  WHERE source_kind = 'AI_PROPOSAL'
    AND source_proposal_id IS NOT NULL
    AND source_item_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_itinerary_ai_proposal
  ON itinerary_items(trip_id, source_proposal_id)
  WHERE source_proposal_id IS NOT NULL;
