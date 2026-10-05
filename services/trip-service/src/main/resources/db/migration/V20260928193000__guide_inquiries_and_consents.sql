-- V20260928193000__guide_inquiries_and_consents.sql
-- Adjustments for Phase 4c Guide Inquiries, Proposals, Consents & Fencing

ALTER TABLE guide_inquiry DROP CONSTRAINT IF EXISTS guide_inquiry_source_promotion_id_fkey;
ALTER TABLE guide_inquiry ADD CONSTRAINT fk_guide_inquiry_promotion FOREIGN KEY (source_promotion_id) REFERENCES partner_guide_promotion(id) ON DELETE SET NULL;

ALTER TABLE guide_inquiry ADD COLUMN IF NOT EXISTS close_reason VARCHAR(500);

ALTER TABLE guide_proposal ADD COLUMN IF NOT EXISTS state VARCHAR(32) NOT NULL DEFAULT 'PENDING';
ALTER TABLE guide_proposal ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

CREATE INDEX IF NOT EXISTS idx_guide_inq_biz_susp ON guide_inquiry(guide_business_id, bound_suspension_version, created_at);
