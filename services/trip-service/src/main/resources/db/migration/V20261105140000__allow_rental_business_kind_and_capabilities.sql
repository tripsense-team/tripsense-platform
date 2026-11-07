-- Allow RENTAL_SERVICE in partner_business kind check constraint
ALTER TABLE partner_business DROP CONSTRAINT IF EXISTS partner_business_kind_check;
ALTER TABLE partner_business ADD CONSTRAINT partner_business_kind_check 
  CHECK (kind IN ('HOTEL', 'RESTAURANT', 'TOUR_GUIDE', 'RENTAL_SERVICE'));

-- Allow RENTAL capabilities in partner_business_capability check constraint
ALTER TABLE partner_business_capability DROP CONSTRAINT IF EXISTS partner_business_capability_capability_check;
ALTER TABLE partner_business_capability ADD CONSTRAINT partner_business_capability_capability_check 
  CHECK (capability IN (
    'HOTEL_LISTING', 'HOTEL_INVENTORY', 'HOTEL_BOOKING',
    'RESTAURANT_LISTING', 'RESTAURANT_MENU',
    'GUIDE_LISTING', 'GUIDE_PROMOTION', 'GUIDE_INQUIRY',
    'RENTAL_LISTING', 'RENTAL_INVENTORY', 'RENTAL_BOOKING'
  ));

