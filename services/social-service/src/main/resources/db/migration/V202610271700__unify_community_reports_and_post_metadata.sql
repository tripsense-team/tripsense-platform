-- ==============================================================================
-- V202610271700__unify_community_reports_and_post_metadata.sql
-- 1. Unify moderation system: Expand social_reports and social_moderation_audit to handle CHAT
-- 2. Flatten social post 1-to-1 extensions into social_posts.metadata JSONB
-- ==============================================================================

-- 1. Expand social_reports for polymorphic community moderation
ALTER TABLE social_reports ALTER COLUMN target_type TYPE VARCHAR(32);
ALTER TABLE social_reports ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL;

ALTER TABLE social_reports DROP CONSTRAINT IF EXISTS social_reports_target_type_chk;
ALTER TABLE social_reports DROP CONSTRAINT IF EXISTS social_reports_target_shape_chk;

ALTER TABLE social_reports ADD CONSTRAINT social_reports_target_type_chk
    CHECK (target_type IN ('POST', 'COMMENT', 'PLACE_REVIEW', 'CHAT_MESSAGE', 'CHAT_USER'));

-- Expand social_moderation_audit
ALTER TABLE social_moderation_audit ALTER COLUMN target_type TYPE VARCHAR(32);
ALTER TABLE social_moderation_audit DROP CONSTRAINT IF EXISTS social_moderation_audit_action_chk;
ALTER TABLE social_moderation_audit ADD CONSTRAINT social_moderation_audit_action_chk
    CHECK (action IN ('DISMISS', 'REMOVE_CONTENT', 'RESTRICT_CHAT'));

-- Backfill chat_reports into social_reports
INSERT INTO social_reports (
    id, target_type, target_id, conversation_id, reporter_id,
    reason, details, status, created_at, reviewed_at, reviewed_by, moderator_note
)
SELECT 
    id,
    CASE WHEN message_id IS NOT NULL THEN 'CHAT_MESSAGE' ELSE 'CHAT_USER' END,
    COALESCE(message_id, reported_user_id),
    conversation_id,
    reporter_id,
    reason,
    details,
    status,
    created_at,
    reviewed_at,
    reviewed_by,
    decision
FROM chat_reports
ON CONFLICT (id) DO NOTHING;

-- Backfill chat_moderation_audits into social_moderation_audit
INSERT INTO social_moderation_audit (
    id, report_id, moderator_id, action, target_type, target_id, note, created_at
)
SELECT 
    cma.id,
    cma.report_id,
    cma.moderator_id,
    cma.action,
    'CHAT_MESSAGE',
    COALESCE(cr.message_id, cr.reported_user_id, cma.report_id),
    cma.reason,
    cma.created_at
FROM chat_moderation_audits cma
JOIN chat_reports cr ON cma.report_id = cr.id
ON CONFLICT (id) DO NOTHING;

-- 2. Flatten social_posts extensions
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) NOT NULL DEFAULT 'PUBLIC';

-- Backfill metadata from social_trip_shares
UPDATE social_posts p
SET visibility = s.visibility,
    metadata = jsonb_build_object(
        'source_trip_id', s.source_trip_id,
        'trip_name', s.trip_name,
        'destination_name', s.destination_name,
        'start_date', s.start_date,
        'end_date', s.end_date,
        'cover_image_url', s.cover_image_url,
        'day_count', s.day_count,
        'itinerary_item_count', s.itinerary_item_count,
        'highlights_json', s.highlights_json,
        'publication_revision', s.publication_revision,
        'snapshot_created_at', s.snapshot_created_at
    )
FROM social_trip_shares s
WHERE p.id = s.post_id AND p.metadata IS NULL;

-- Backfill metadata from social_guide_promotion
UPDATE social_posts p
SET metadata = jsonb_build_object(
        'source_promotion_id', g.source_promotion_id,
        'source_business_id', g.source_business_id,
        'source_owner_id', g.source_owner_id,
        'approved_revision_id', g.approved_revision_id,
        'distribution_version', g.distribution_version,
        'distribution_enabled', g.distribution_enabled
    )
FROM social_guide_promotion g
WHERE p.id = g.post_id AND p.metadata IS NULL;

-- High-performance index for public feed
CREATE INDEX IF NOT EXISTS idx_social_posts_public_feed
    ON social_posts (created_at DESC, id DESC)
    WHERE deleted_at IS NULL AND visibility = 'PUBLIC';
