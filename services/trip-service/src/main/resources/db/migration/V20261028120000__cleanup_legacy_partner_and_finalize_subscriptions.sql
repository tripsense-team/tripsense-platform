-- V20261028120000__cleanup_legacy_partner_and_finalize_subscriptions.sql
-- Remove legacy booking, availability, wallet, and withdrawal tables

DROP TABLE IF EXISTS restaurant_reservation_transition CASCADE;
DROP TABLE IF EXISTS restaurant_reservation_request CASCADE;
DROP TABLE IF EXISTS restaurant_availability CASCADE;
DROP TABLE IF EXISTS partner_withdrawal_request CASCADE;
DROP TABLE IF EXISTS partner_wallet CASCADE;
DROP TABLE IF EXISTS financial_ledger_entry CASCADE;
DROP TABLE IF EXISTS hotel_booking CASCADE;
DROP TABLE IF EXISTS hotel_voucher_redemption CASCADE;
DROP TABLE IF EXISTS hotel_voucher CASCADE;
DROP TABLE IF EXISTS hotel_demo_ledger CASCADE;
DROP TABLE IF EXISTS hotel_demo_command CASCADE;
DROP TABLE IF EXISTS hotel_demo_payment CASCADE;
DROP TABLE IF EXISTS hotel_payos_payment CASCADE;
DROP TABLE IF EXISTS hotel_payos_receipt CASCADE;
DROP TABLE IF EXISTS hotel_request_lock CASCADE;
DROP TABLE IF EXISTS customer_refund_request CASCADE;

-- Ensure optimal indexes on partner_subscription and partner_subscription_order
CREATE INDEX IF NOT EXISTS idx_partner_sub_biz_status ON partner_subscription(business_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_sub_order_biz_created ON partner_subscription_order(business_id, created_at DESC);
