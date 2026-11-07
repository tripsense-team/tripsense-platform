-- ==============================================================================
-- V202611051300__allow_rental_business_type_in_chat_offers.sql
-- Allow 'RENTAL' business_type in chat_reservation_offers
-- ==============================================================================

ALTER TABLE chat_reservation_offers DROP CONSTRAINT IF EXISTS chat_reservation_offers_business_type_check;

ALTER TABLE chat_reservation_offers ADD CONSTRAINT chat_reservation_offers_business_type_check 
    CHECK (business_type IN ('HOTEL', 'RESTAURANT', 'GUIDE', 'RENTAL'));

