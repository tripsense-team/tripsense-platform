-- Seed default restaurant booking availability and opening intervals for restaurants
INSERT INTO restaurant_availability (
  business_id, time_zone, capacity_guests, reservation_duration_minutes,
  slot_interval_minutes, minimum_lead_minutes, maximum_advance_days,
  pending_hold_minutes, version, updated_at
)
SELECT 
  id, 'Asia/Ho_Chi_Minh', 50, 90, 30, 30, 30, 120, 0, now()
FROM partner_business
WHERE kind = 'RESTAURANT'
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO restaurant_opening_interval (id, business_id, day_of_week, opens_at, closes_at)
SELECT 
  gen_random_uuid(), b.id, d.day, '08:00:00'::time, '22:00:00'::time
FROM partner_business b
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6), (7)) AS d(day)
WHERE b.kind = 'RESTAURANT'
AND NOT EXISTS (
  SELECT 1 FROM restaurant_opening_interval roi WHERE roi.business_id = b.id AND roi.day_of_week = d.day
);

