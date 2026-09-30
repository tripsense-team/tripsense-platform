CREATE SEQUENCE hotel_payos_order_code_seq;

CREATE TABLE hotel_payos_payment (
  booking_id uuid PRIMARY KEY REFERENCES hotel_booking(id),
  order_code bigint NOT NULL UNIQUE DEFAULT nextval('hotel_payos_order_code_seq'),
  payment_link_id varchar(128) UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL CHECK (currency = 'VND'),
  state varchar(20) NOT NULL CHECK (state IN ('CREATING','PENDING','PAID','CANCELLED','EXPIRED','FAILED')),
  resolution varchar(24) NOT NULL DEFAULT 'NONE' CHECK (resolution IN ('NONE','REFUND_REQUIRED','REVIEW_REQUIRED')),
  checkout_url text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  last_checked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code varchar(64)
);

CREATE INDEX hotel_payos_payment_reconcile ON hotel_payos_payment(next_attempt) WHERE state IN ('CREATING','PENDING');

CREATE TABLE hotel_payos_receipt (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES hotel_payos_payment(booking_id),
  provider_reference varchar(128) NOT NULL UNIQUE,
  received_amount bigint NOT NULL CHECK (received_amount > 0),
  currency varchar(3) NOT NULL,
  received_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
