-- ==============================================================================
-- V202610271500__consolidate_social_reactions_and_optimize_indexes.sql
-- Phase 1 Consolidation: Polymorphic reactions table & missing performance indexes
-- ==============================================================================

-- 1. Create unified polymorphic social_reactions table
CREATE TABLE IF NOT EXISTS social_reactions (
    id UUID PRIMARY KEY,
    target_type VARCHAR(16) NOT NULL,
    target_id UUID NOT NULL,
    user_id UUID NOT NULL,
    reaction_type VARCHAR(16) NOT NULL DEFAULT 'LIKE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_social_reactions UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_social_reactions_target ON social_reactions (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_social_reactions_user ON social_reactions (user_id, target_type);

-- 2. Backfill existing data from social_post_likes and social_comment_likes
INSERT INTO social_reactions (id, target_type, target_id, user_id, reaction_type, created_at)
SELECT gen_random_uuid(), 'POST', post_id, user_id, 'LIKE', created_at 
FROM social_post_likes
ON CONFLICT (user_id, target_type, target_id) DO NOTHING;

INSERT INTO social_reactions (id, target_type, target_id, user_id, reaction_type, created_at)
SELECT gen_random_uuid(), 'COMMENT', comment_id, user_id, 'LIKE', created_at 
FROM social_comment_likes
ON CONFLICT (user_id, target_type, target_id) DO NOTHING;

-- 3. Add reverse indexes to legacy likes tables for transition query optimization
CREATE INDEX IF NOT EXISTS idx_social_post_likes_user_post ON social_post_likes (user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_social_comment_likes_user_comment ON social_comment_likes (user_id, comment_id);

-- 4. Add missing performance indexes identified in database review
CREATE INDEX IF NOT EXISTS idx_social_reports_target ON social_reports (target_type, target_id, status);

CREATE INDEX IF NOT EXISTS idx_social_comments_active_post_created
    ON social_comments (post_id, created_at ASC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_moderation_audits_report_id ON chat_moderation_audits (report_id);
