DO $$
DECLARE
    actual_type TEXT;
BEGIN
    SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO actual_type
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'social_trip_share_snapshots'::regclass
      AND attribute.attname = 'payload_sha256'
      AND NOT attribute.attisdropped;

    IF actual_type IS NULL THEN
        RAISE EXCEPTION 'Expected column social_trip_share_snapshots.payload_sha256 is missing';
    END IF;

    IF actual_type <> 'character varying(64)' THEN
        ALTER TABLE social_trip_share_snapshots
            ALTER COLUMN payload_sha256 TYPE VARCHAR(64);
    END IF;
END $$;
