-- V20260928220000__create_social_guide_promotions.sql
-- Community Integration: Guide Promotions projection, comment revision snapshot, and integration receipts

ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS submitted_under_revision INTEGER;

CREATE TABLE IF NOT EXISTS social_guide_promotion (
    post_id UUID PRIMARY KEY REFERENCES social_posts(id) ON DELETE CASCADE,
    source_promotion_id UUID NOT NULL UNIQUE,
    source_business_id UUID NOT NULL,
    source_owner_id UUID NOT NULL,
    approved_revision_id UUID NOT NULL,
    distribution_version BIGINT NOT NULL DEFAULT 1,
    distribution_enabled BOOLEAN NOT NULL DEFAULT true,
    removed_at TIMESTAMPTZ,
    removal_reason VARCHAR(500),
    removed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS social_guide_promotions_source_idx ON social_guide_promotion (source_promotion_id);
CREATE INDEX IF NOT EXISTS social_guide_promotions_active_idx ON social_guide_promotion (distribution_enabled, post_id) WHERE removed_at IS NULL;

CREATE TABLE IF NOT EXISTS social_integration_receipt (
    event_id UUID PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    source_promotion_id UUID NOT NULL,
    applied_version BIGINT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
