UPDATE social_trip_shares
SET itinerary_json = '[]'::jsonb,
    highlights_json = '[]'::jsonb,
    traveler_count = NULL
WHERE itinerary_json IS DISTINCT FROM '[]'::jsonb
   OR highlights_json IS DISTINCT FROM '[]'::jsonb
   OR traveler_count IS NOT NULL;

ALTER TABLE social_trip_shares
    ALTER COLUMN itinerary_json SET DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'social_trip_shares_legacy_itinerary_empty_chk'
          AND conrelid = 'social_trip_shares'::regclass
    ) THEN
        ALTER TABLE social_trip_shares
            ADD CONSTRAINT social_trip_shares_legacy_itinerary_empty_chk
            CHECK (itinerary_json IS NULL OR itinerary_json = '[]'::jsonb);
    END IF;
END $$;
