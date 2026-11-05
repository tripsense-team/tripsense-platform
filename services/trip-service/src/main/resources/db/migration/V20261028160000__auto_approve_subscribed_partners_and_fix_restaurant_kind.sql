-- Auto-approve and publish any business that has an active partner subscription
UPDATE partner_business b
SET approval_validity = 'VALID',
    operation_state = 'ACTIVE',
    publication_state = 'PUBLISHED',
    accepting_new = true,
    requires_reverification = false,
    updated_at = NOW()
FROM partner_subscription s
WHERE b.id = s.business_id
  AND s.status = 'ACTIVE'
  AND s.valid_to > NOW();

-- Fix Riverside Terrace Restaurant kind to RESTAURANT if misclassified as HOTEL
UPDATE partner_business
SET kind = 'RESTAURANT',
    approval_validity = 'VALID',
    operation_state = 'ACTIVE',
    publication_state = 'PUBLISHED',
    accepting_new = true,
    requires_reverification = false,
    updated_at = NOW()
WHERE id = '84275376-e775-4224-a1e9-95f583dab2a3';

UPDATE partner_subscription
SET current_plan_id = 'REST_PLAN_1_MONTH'
WHERE business_id = '84275376-e775-4224-a1e9-95f583dab2a3';

