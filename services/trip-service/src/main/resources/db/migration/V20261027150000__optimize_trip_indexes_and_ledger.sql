-- ==============================================================================
-- V20261027150000__optimize_trip_indexes_and_ledger.sql
-- Optimize active trip queries, visibility filtering, and partner ledger wallet history
-- ==============================================================================

-- 1. Partial indexes for active (non-archived) trips
CREATE INDEX IF NOT EXISTS idx_trips_owner_active_start 
    ON trips (owner_user_id, start_date DESC) 
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trips_owner_visibility_active 
    ON trips (owner_user_id, visibility) 
    WHERE archived_at IS NULL;

-- 2. Partner ledger wallet history index
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_history 
    ON financial_ledger_entry (wallet_id, created_at DESC);
