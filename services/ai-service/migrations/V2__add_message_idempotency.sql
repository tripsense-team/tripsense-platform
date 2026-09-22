ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_messages_owner_idempotency') THEN
    ALTER TABLE messages ADD CONSTRAINT uq_messages_owner_idempotency UNIQUE(owner_user_id, idempotency_key);
  END IF;
END $$;
