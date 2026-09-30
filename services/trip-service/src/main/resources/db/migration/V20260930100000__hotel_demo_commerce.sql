-- Legacy unlinked properties remain readable for existing obligations, but cannot sell new stays.
CREATE UNIQUE INDEX hotel_property_business_unique ON hotel_property(business_id) WHERE business_id IS NOT NULL;

CREATE TABLE hotel_demo_payment (
 booking_id uuid PRIMARY KEY REFERENCES hotel_booking(id),
 state varchar(20) NOT NULL CHECK(state IN ('CAPTURED','REFUNDED')),
 amount numeric(18,2) NOT NULL CHECK(amount>0), currency varchar(3) NOT NULL CHECK(currency='VND'),
 commission_bps integer NOT NULL CHECK(commission_bps=1000),
 commission_amount numeric(18,2) NOT NULL CHECK(commission_amount>=0),
 partner_amount numeric(18,2) NOT NULL CHECK(partner_amount>=0),
 captured_at timestamptz NOT NULL DEFAULT now(), refunded_at timestamptz,
 CHECK(amount=commission_amount+partner_amount)
);
CREATE TABLE hotel_demo_command (
 id uuid PRIMARY KEY, actor_id uuid NOT NULL, booking_id uuid NOT NULL REFERENCES hotel_booking(id),
 operation varchar(20) NOT NULL CHECK(operation IN ('PAYMENT','SETTLEMENT')),
 request_key varchar(100) NOT NULL, payload varchar(30) NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,operation,request_key)
);
CREATE TABLE hotel_demo_ledger (
 id uuid PRIMARY KEY, booking_id uuid NOT NULL REFERENCES hotel_booking(id),
 event varchar(20) NOT NULL CHECK(event IN ('CAPTURE','REFUND','PAYOUT')),
 gross numeric(18,2) NOT NULL CHECK(gross>0),
 commission numeric(18,2) NOT NULL CHECK(commission>=0),
 partner_amount numeric(18,2) NOT NULL CHECK(partner_amount>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(gross=commission+partner_amount), UNIQUE(booking_id,event)
);
CREATE INDEX hotel_demo_ledger_created ON hotel_demo_ledger(created_at);

INSERT INTO partner_review_checklist(id,kind,region,version,items_json,effective_at)
SELECT 'CHK-' || label || '-V1', kind, 'GLOBAL', '1.0',
 '[{"code":"PROFILE","required":true,"label":"Profile details reviewed (demo)"},{"code":"CONTACT","required":true,"label":"Contact details reviewed (demo)"},{"code":"OWNERSHIP","required":true,"label":"Representation reviewed (demo; not legal verification)"}]'::jsonb, now()
FROM (VALUES ('HOTEL','HOTEL'),('RESTAURANT','RESTAURANT'),('GUIDE','TOUR_GUIDE')) AS kinds(label,kind)
ON CONFLICT (id,version) DO NOTHING;

ALTER TABLE guide_proposal ADD COLUMN contact_email varchar(254);
ALTER TABLE partner_inquiry_contact_consent ADD COLUMN contact_value varchar(254);
