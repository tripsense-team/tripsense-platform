CREATE TABLE hotel_property (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, owner_email varchar(254) NOT NULL,
 name varchar(160) NOT NULL, destination varchar(120) NOT NULL, address varchar(500) NOT NULL,
 time_zone varchar(80) NOT NULL, check_in_time varchar(5) NOT NULL, check_out_time varchar(5) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','REJECTED','SUSPENDED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hotel_property_destination ON hotel_property(lower(destination), status);
CREATE INDEX hotel_property_owner ON hotel_property(owner_id);
CREATE TABLE hotel_room_type (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES hotel_property(id),
 name varchar(160) NOT NULL, capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 20)
);
CREATE INDEX hotel_room_property ON hotel_room_type(property_id);
CREATE TABLE hotel_inventory (
 room_type_id uuid NOT NULL REFERENCES hotel_room_type(id), stay_date date NOT NULL,
 allocation integer NOT NULL CHECK(allocation BETWEEN 0 AND 10000),
 held integer NOT NULL DEFAULT 0 CHECK(held >= 0), booked integer NOT NULL DEFAULT 0 CHECK(booked >= 0),
 nightly_price numeric(16,2) NOT NULL CHECK(nightly_price > 0), stop_sell boolean NOT NULL DEFAULT false,
 PRIMARY KEY(room_type_id,stay_date), CHECK(held + booked <= allocation)
);
CREATE TABLE hotel_request_lock (customer_id uuid PRIMARY KEY);
CREATE TABLE hotel_booking (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES hotel_property(id),
 room_type_id uuid NOT NULL REFERENCES hotel_room_type(id), customer_id uuid NOT NULL,
 customer_email varchar(254) NOT NULL, request_key varchar(100) NOT NULL,
 property_name varchar(160) NOT NULL, room_name varchar(160) NOT NULL, time_zone varchar(80) NOT NULL,
 check_in date NOT NULL, check_out date NOT NULL, quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10),
 guests integer NOT NULL CHECK(guests BETWEEN 1 AND 200), total numeric(18,2) NOT NULL CHECK(total > 0),
 currency varchar(3) NOT NULL DEFAULT 'VND', payment_method varchar(30) NOT NULL DEFAULT 'PAY_AT_PROPERTY',
 cancellation_policy varchar(100) NOT NULL DEFAULT 'FREE_BEFORE_CHECK_IN',
 status varchar(20) NOT NULL CHECK(status IN ('HELD','CONFIRMED','CANCELLED','EXPIRED')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(check_out > check_in), UNIQUE(customer_id,request_key)
);
CREATE INDEX hotel_booking_customer ON hotel_booking(customer_id,created_at DESC);
CREATE INDEX hotel_booking_property ON hotel_booking(property_id,created_at DESC);
CREATE INDEX hotel_booking_expiry ON hotel_booking(expires_at) WHERE status='HELD';
CREATE TABLE hotel_outbox (
 id uuid PRIMARY KEY, aggregate_id uuid NOT NULL, event_type varchar(50) NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
 dead_letter boolean NOT NULL DEFAULT false, last_error varchar(50)
);
CREATE INDEX hotel_outbox_pending ON hotel_outbox(created_at) WHERE processed_at IS NULL;
CREATE TABLE hotel_notification (
 id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES hotel_outbox(id), recipient_id uuid NOT NULL,
 event_type varchar(50) NOT NULL, aggregate_id uuid NOT NULL, message varchar(600) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, UNIQUE(event_id,recipient_id)
);
CREATE INDEX hotel_notification_recipient ON hotel_notification(recipient_id,created_at DESC);
CREATE TABLE hotel_email_delivery (
 id uuid PRIMARY KEY REFERENCES hotel_notification(id), recipient_email varchar(254) NOT NULL,
 subject varchar(160) NOT NULL, message varchar(600) NOT NULL,
 state varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','SENDING','SENT','DEAD')),
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
 first_attempt timestamptz, lease_until timestamptz, lease_token uuid,
 last_error varchar(50), sent_at timestamptz
);
CREATE INDEX hotel_email_due ON hotel_email_delivery(next_attempt) WHERE state IN ('PENDING','SENDING');
