ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS publication_revision BIGINT NOT NULL DEFAULT 0;

ALTER TABLE trips
    ADD CONSTRAINT ck_trips_publication_revision_non_negative
    CHECK (publication_revision >= 0);
