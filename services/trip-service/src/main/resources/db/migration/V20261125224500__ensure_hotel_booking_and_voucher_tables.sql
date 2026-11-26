-- Idempotent safety migration ensuring all hotel booking & voucher tables/columns exist
-- (remediates local/dev databases where an earlier compatibility schema drop removed them).

CREATE TABLE IF NOT EXISTS hotel_request_lock (
  customer_id uuid PRIMARY KEY
);

ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS subtotal numeric(12,2);
UPDATE hotel_booking SET subtotal = total WHERE subtotal IS NULL;
ALTER TABLE hotel_booking ALTER COLUMN subtotal SET NOT NULL;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE hotel_booking ADD COLUMN IF NOT EXISTS voucher_code varchar(32);

CREATE TABLE IF NOT EXISTS hotel_voucher (
  code varchar(32) PRIMARY KEY,
  title varchar(120) NOT NULL,
  description varchar(500),
  discount_type varchar(16) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED_AMOUNT')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  max_discount_amount numeric(12,2),
  min_order_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'VND',
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  usage_limit integer NOT NULL DEFAULT 100,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_voucher_redemption (
  id uuid PRIMARY KEY,
  voucher_code varchar(32) NOT NULL REFERENCES hotel_voucher(code),
  booking_id uuid NOT NULL REFERENCES hotel_booking(id),
  customer_id uuid NOT NULL,
  discount_amount numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
  state varchar(16) NOT NULL CHECK (state IN ('APPLIED', 'COMMITTED', 'RELEASED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_voucher_booking UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS idx_voucher_redemption_customer
  ON hotel_voucher_redemption(customer_id, voucher_code);

