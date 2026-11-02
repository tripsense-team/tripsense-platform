-- 1. Modify chat_messages.type to VARCHAR(32) to support RESERVATION_OFFER
ALTER TABLE chat_messages ALTER COLUMN type TYPE VARCHAR(32);
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN ('TEXT', 'SHARED_TRIP', 'RESERVATION_OFFER'));

-- 2. Add offer_id column to chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS offer_id UUID;

-- 3. Update payload constraint on chat_messages
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_message_payload;
ALTER TABLE chat_messages ADD CONSTRAINT chat_message_payload CHECK (
  (type = 'TEXT' AND text IS NOT NULL AND char_length(text) BETWEEN 1 AND 2000 AND shared_post_id IS NULL AND offer_id IS NULL)
  OR (type = 'SHARED_TRIP' AND text IS NULL AND shared_post_id IS NOT NULL AND offer_id IS NULL)
  OR (type = 'RESERVATION_OFFER' AND offer_id IS NOT NULL)
);

-- 4. Create chat_reservation_offers table
CREATE TABLE IF NOT EXISTS chat_reservation_offers (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id UUID,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  business_type VARCHAR(32) NOT NULL CHECK (business_type IN ('HOTEL', 'RESTAURANT', 'GUIDE')),
  business_id UUID NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_thumbnail VARCHAR(512),
  item_title VARCHAR(255) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE,
  reservation_time TIME,
  adults_count INT NOT NULL DEFAULT 1,
  children_count INT NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'VND',
  inclusions TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
  decline_reason VARCHAR(500),
  booking_id UUID,
  booking_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_offers_conversation ON chat_reservation_offers (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_offers_recipient_status ON chat_reservation_offers (recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_offers_expires ON chat_reservation_offers (status, expires_at);

