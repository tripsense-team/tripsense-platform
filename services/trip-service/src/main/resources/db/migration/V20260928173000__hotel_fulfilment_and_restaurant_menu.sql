-- V20260928173000__hotel_fulfilment_and_restaurant_menu.sql
-- Format: YYYYMMDDHHMMSS (14 digits) for monotonic Flyway versioning

-- 1. Extend hotel_booking status check and add lifecycle timestamps + cancellation info
ALTER TABLE hotel_booking DROP CONSTRAINT IF EXISTS hotel_booking_status_check;
ALTER TABLE hotel_booking ADD CONSTRAINT hotel_booking_status_check CHECK (
    status IN ('HELD', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED', 'EXPIRED')
);

ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS check_in_at timestamptz;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS check_out_at timestamptz;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS free_cancellation_until timestamptz;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS no_show_after timestamptz;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS cancellation_reason varchar(500);
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS cancelled_by varchar(30);
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES partner_business(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_booking_biz ON hotel_booking(business_id);

-- 2. Link hotel_property to partner_business
ALTER TABLE hotel_property ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES partner_business(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_prop_biz ON hotel_property(business_id);

-- 3. Public contact consent on partner_business
ALTER TABLE partner_business ADD COLUMN IF NOT EXISTS public_contact_consent boolean NOT NULL DEFAULT false;

-- 4. Restaurant Menu Catalog
CREATE TABLE IF NOT EXISTS restaurant_menu_item (
    id uuid PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    category varchar(80),
    description varchar(500),
    price numeric(16,2) NOT NULL CHECK (price > 0),
    currency varchar(3) NOT NULL DEFAULT 'VND',
    tags jsonb,
    available boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_menu_biz ON restaurant_menu_item(business_id);

-- 5. Partner Support Cases
ALTER TABLE partner_support_case ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES partner_business(id) ON DELETE CASCADE;
ALTER TABLE partner_support_case ADD COLUMN IF NOT EXISTS assigned_admin uuid;

CREATE INDEX IF NOT EXISTS idx_support_case_res ON partner_support_case(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_support_case_biz ON partner_support_case(business_id);
CREATE INDEX IF NOT EXISTS idx_support_case_state ON partner_support_case(state);
