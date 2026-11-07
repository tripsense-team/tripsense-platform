-- V20261028120000__cleanup_legacy_partner_and_finalize_subscriptions.sql
-- Ensure optimal indexes on partner_subscription and partner_subscription_order

CREATE INDEX IF NOT EXISTS idx_partner_sub_biz_status ON partner_subscription(business_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_sub_order_biz_created ON partner_subscription_order(business_id, created_at DESC);
