-- Phase 4b: Guide Profile and Promotions

CREATE TABLE IF NOT EXISTS partner_guide_promotion (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    approved_revision_id UUID,
    publication_state VARCHAR(32) NOT NULL DEFAULT 'HIDDEN',
    community_enabled BOOLEAN NOT NULL DEFAULT false,
    community_post_id UUID,
    distribution_version BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_guide_promotion_biz ON partner_guide_promotion(business_id);
CREATE INDEX IF NOT EXISTS idx_guide_promotion_pub ON partner_guide_promotion(publication_state);

CREATE TABLE IF NOT EXISTS partner_guide_promotion_revision (
    id UUID PRIMARY KEY,
    promotion_id UUID NOT NULL REFERENCES partner_guide_promotion(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    approved_profile_revision_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary TEXT NOT NULL,
    area_id VARCHAR(64) NOT NULL,
    topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    skill_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_duration VARCHAR(100),
    inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
    indicative_price_amount NUMERIC(14,2),
    indicative_price_currency VARCHAR(10) DEFAULT 'VND',
    indicative_price_unit VARCHAR(32) NOT NULL,
    cover_image_ref VARCHAR(500),
    gallery_image_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
    state VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    review_decision_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_guide_promotion_revision UNIQUE (promotion_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_guide_promo_rev_promo ON partner_guide_promotion_revision(promotion_id);
CREATE INDEX IF NOT EXISTS idx_guide_promo_rev_state ON partner_guide_promotion_revision(state);

CREATE TABLE IF NOT EXISTS partner_guide_promotion_media (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES partner_guide_promotion(id) ON DELETE SET NULL,
    object_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'PENDING_UPLOAD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_guide_media_biz ON partner_guide_promotion_media(business_id);
