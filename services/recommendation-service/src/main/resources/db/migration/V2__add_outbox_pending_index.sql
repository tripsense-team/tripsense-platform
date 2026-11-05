-- ==============================================================================
-- V2__add_outbox_pending_index.sql
-- Optimize outbox worker polling for unprocessed recommendation events
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_recommendation_outbox_pending 
    ON recommendation_outbox (occurred_at ASC) 
    WHERE published_at IS NULL;
