-- V20261028150000__set_test_partner_subscription_prices.sql
-- Set affordable testing subscription prices: 5k (1 month), 10k (3 months), 20k (1 year)

UPDATE partner_subscription_plan 
SET price_vnd = 5000, original_price_vnd = 10000 
WHERE duration_days = 30;

UPDATE partner_subscription_plan 
SET price_vnd = 10000, original_price_vnd = 20000 
WHERE duration_days = 90;

UPDATE partner_subscription_plan 
SET price_vnd = 20000, original_price_vnd = 50000 
WHERE duration_days = 365;

