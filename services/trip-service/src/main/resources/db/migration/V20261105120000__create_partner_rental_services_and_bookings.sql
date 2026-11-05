-- ==============================================================================
-- V20261105120000__create_partner_rental_services_and_bookings.sql
-- Generic Travel Rental & Activity Services Subsystem
-- Supports: Vehicles (Motorbikes, Cars, Bicycles) & Activity Equipment (Camping, SUP, Diving)
-- ==============================================================================

-- 1. Bảng danh mục phương tiện / thiết bị cho thuê
CREATE TABLE IF NOT EXISTS partner_rental_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,      -- 'VEHICLE', 'EQUIPMENT', 'ACTIVITY_GEAR', 'EXPERIENCE'
    subcategory VARCHAR(50),            -- 'SCOOTER', 'MANUAL_MOTORBIKE', 'CAR_4_SEAT', 'CAMPING_TENT', 'SUP'
    description TEXT,
    images JSONB NOT NULL DEFAULT '[]',
    price_per_day NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    price_per_hour NUMERIC(12, 2),
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deposit_policy VARCHAR(500),
    total_inventory INT NOT NULL DEFAULT 1 CHECK (total_inventory >= 1),
    delivery_available BOOLEAN NOT NULL DEFAULT false,
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    specifications JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rental_item_biz ON partner_rental_item(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rental_item_category ON partner_rental_item(category, is_active);

-- 2. Bảng đơn đặt thuê (Rental Booking Order)
CREATE TABLE IF NOT EXISTS rental_booking_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code VARCHAR(32) NOT NULL UNIQUE, -- '#TS-RNT-XXXXXXXX'
    business_id UUID NOT NULL REFERENCES partner_business(id),
    rental_item_id UUID NOT NULL REFERENCES partner_rental_item(id),
    customer_id UUID NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(160),
    
    pickup_at TIMESTAMPTZ NOT NULL,
    return_at TIMESTAMPTZ NOT NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    
    pickup_option VARCHAR(30) NOT NULL DEFAULT 'PICKUP_AT_STORE', -- 'PICKUP_AT_STORE', 'DELIVERY_TO_LOCATION'
    delivery_address TEXT,
    
    rental_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'VND',
    
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', 
    -- 'PENDING', 'CONFIRMED', 'IN_USE', 'RETURNED', 'CANCELLED', 'EXPIRED', 'REJECTED'
    
    handover_at TIMESTAMPTZ,              -- Thời điểm bàn giao xe/đồ
    returned_at TIMESTAMPTZ,              -- Thời điểm khách trả đồ hoàn tất
    overdue_fee NUMERIC(12, 2) DEFAULT 0, -- Phụ phí phát sinh trễ giờ hoặc hư hao
    
    customer_note TEXT,
    partner_note TEXT,
    rejection_reason TEXT,
    
    chat_offer_id UUID,                   -- Liên kết nếu đơn phát sinh từ khung chat
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_rental_dates CHECK (return_at > pickup_at)
);

CREATE INDEX IF NOT EXISTS idx_rental_booking_biz_status ON rental_booking_order(business_id, status, pickup_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_booking_customer ON rental_booking_order(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rental_booking_inventory ON rental_booking_order(rental_item_id, status, pickup_at, return_at);

