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

