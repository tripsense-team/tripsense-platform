ALTER TABLE social_trip_shares
    ADD COLUMN IF NOT EXISTS itinerary_json JSONB;
