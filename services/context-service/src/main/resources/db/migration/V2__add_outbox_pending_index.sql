-- ==============================================================================
-- V2__add_outbox_pending_index.sql
-- Optimize outbox worker polling for unprocessed context events
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_context_outbox_pending 
    ON context_outbox (created_at ASC) 
    WHERE published_at IS NULL;
