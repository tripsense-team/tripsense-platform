CREATE TABLE place_reviews (
    id UUID PRIMARY KEY,
    place_ref VARCHAR(200) NOT NULL,
    author_user_id UUID NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (status IN ('PUBLISHED', 'REMOVED')),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_review_content_length
        CHECK (char_length(btrim(content)) BETWEEN 10 AND 2000)
);

CREATE UNIQUE INDEX uq_review_active_author_place
    ON place_reviews(author_user_id, place_ref)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_review_place_published_created
    ON place_reviews(place_ref, created_at DESC)
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX idx_review_place_published_rating
    ON place_reviews(place_ref, rating)
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
