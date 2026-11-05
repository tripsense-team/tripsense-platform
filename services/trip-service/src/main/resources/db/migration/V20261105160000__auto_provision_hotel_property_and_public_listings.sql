-- Auto-provision hotel_property for all approved HOTEL partner businesses
INSERT INTO hotel_property (
    id,
    business_id,
    owner_id,
    owner_email,
    name,
    destination,
    address,
    time_zone,
    check_in_time,
    check_out_time,
    status,
    created_at
)
SELECT
    gen_random_uuid(),
    b.id,
    b.owner_user_id,
    COALESCE(b.draft_profile_json->>'email', 'partner@tripsense.vn'),
    b.display_name,
    COALESCE(NULLIF(b.draft_profile_json->>'destination', ''), 'Đà Nẵng'),
    COALESCE(NULLIF(b.draft_profile_json->>'address', ''), b.display_name),
    'Asia/Ho_Chi_Minh',
    '14:00',
    '11:00',
    'ACTIVE',
    now()
FROM partner_business b
WHERE b.kind = 'HOTEL'
  AND b.approval_validity = 'VALID'
  AND NOT EXISTS (
      SELECT 1 FROM hotel_property p WHERE p.business_id = b.id
  );

-- Auto-provision a default room type and 90-day inventory for active hotel properties with 0 rooms
DO $$
DECLARE
    r RECORD;
    v_room_id UUID;
    v_day INT;
BEGIN
    FOR r IN
        SELECT p.id AS prop_id
        FROM hotel_property p
        JOIN partner_business b ON b.id = p.business_id
        WHERE p.status = 'ACTIVE'
          AND b.publication_state = 'PUBLISHED'
          AND NOT EXISTS (
              SELECT 1 FROM hotel_room_type rt WHERE rt.property_id = p.id
          )
    LOOP
        v_room_id := gen_random_uuid();
        INSERT INTO hotel_room_type (id, property_id, name, capacity)
        VALUES (v_room_id, r.prop_id, 'Phòng Deluxe River View', 2);

        FOR v_day IN 0..89 LOOP
            INSERT INTO hotel_inventory (room_type_id, stay_date, allocation, nightly_price, stop_sell)
            VALUES (v_room_id, CURRENT_DATE + v_day, 5, 650000.00, false)
            ON CONFLICT (room_type_id, stay_date) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Ensure Ibiza Riverfront Hotel has an active partner subscription
INSERT INTO partner_subscription (
    id,
    business_id,
    current_plan_id,
    status,
    valid_from,
    valid_to,
    last_payment_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'aafe96e8-73a7-4f71-b5d2-669b29c08f5b',
    'HOTEL_PLAN_1_YEAR',
    'ACTIVE',
    NOW(),
    NOW() + INTERVAL '365 days',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (business_id) DO UPDATE SET
    status = 'ACTIVE',
    valid_to = NOW() + INTERVAL '365 days';

