-- V20260928165000__partner_notifications_and_documents.sql
-- Format: YYYYMMDDHHMMSS (14 digits) for monotonic versioning

CREATE TABLE IF NOT EXISTS partner_notification (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    event_type varchar(60) NOT NULL,
    business_id uuid,
    message varchar(600) NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (event_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_notification_recipient ON partner_notification(recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_email_delivery (
    id uuid PRIMARY KEY REFERENCES partner_notification(id) ON DELETE CASCADE,
    recipient_email varchar(254) NOT NULL,
    subject varchar(200) NOT NULL,
    message varchar(1000) NOT NULL,
    state varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'SENDING', 'SENT', 'DEAD')),
    attempts integer NOT NULL DEFAULT 0,
    next_attempt timestamptz NOT NULL DEFAULT now(),
    first_attempt timestamptz,
    lease_until timestamptz,
    lease_token uuid,
    last_error varchar(100),
    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_email_due ON partner_email_delivery(next_attempt) WHERE state IN ('PENDING', 'SENDING');

-- Alter existing partner_document table from V20260928143500 to add updated_at and target constraint
ALTER TABLE partner_document ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE partner_document ALTER COLUMN file_version DROP NOT NULL;
ALTER TABLE partner_document ALTER COLUMN file_hash DROP NOT NULL;
ALTER TABLE partner_document DROP CONSTRAINT IF EXISTS chk_partner_doc_target;
ALTER TABLE partner_document ADD CONSTRAINT chk_partner_doc_target CHECK (
    (business_id IS NOT NULL AND claim_id IS NULL) OR
    (business_id IS NULL AND claim_id IS NOT NULL)
);
