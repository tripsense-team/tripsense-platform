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

CREATE INDEX IF NOT EXISTS idx_voucher_redemption_customer ON hotel_voucher_redemption(customer_id, voucher_code);

-- Seed introductory platform vouchers
INSERT INTO hotel_voucher(code, title, description, discount_type, discount_value, max_discount_amount, min_order_amount, valid_from, valid_until, usage_limit)
VALUES
  ('WELCOME50', 'Chào mừng thành viên mới', 'Giảm trực tiếp 50.000đ cho đơn đặt phòng từ 200.000đ', 'FIXED_AMOUNT', 50000, 50000, 200000, now() - interval '1 day', now() + interval '90 days', 500),
  ('SUMMER10', 'Ưu đãi mùa du lịch', 'Giảm 10% tối đa 150.000đ cho mọi đơn đặt phòng từ 500.000đ', 'PERCENT', 10, 150000, 500000, now() - interval '1 day', now() + interval '90 days', 1000),
  ('TRIPSENSE100', 'Tri ân khách hàng TripSense', 'Giảm 100.000đ cho các đơn đặt phòng từ 1.000.000đ', 'FIXED_AMOUNT', 100000, 100000, 1000000, now() - interval '1 day', now() + interval '90 days', 200)
ON CONFLICT (code) DO NOTHING;
