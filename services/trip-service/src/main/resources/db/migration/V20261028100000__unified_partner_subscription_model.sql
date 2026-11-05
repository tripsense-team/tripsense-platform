-- Unified Partner Subscription Model for all Partner Businesses (HOTEL, RESTAURANT, TOUR_GUIDE)

-- 1. Bảng danh mục gói cước đối tác
CREATE TABLE IF NOT EXISTS partner_subscription_plan (
    plan_id VARCHAR(50) PRIMARY KEY,
    business_kind VARCHAR(30) NOT NULL, -- 'HOTEL', 'RESTAURANT', 'TOUR_GUIDE'
    name VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL,         -- 30, 90, 365
    price_vnd DECIMAL(12, 2) NOT NULL,
    original_price_vnd DECIMAL(12, 2),
    discount_percent INT DEFAULT 0,
    tagline VARCHAR(255),
    badge_label VARCHAR(50),           -- 'Verified Partner', 'Verified Accommodation', 'Verified Local Guide'
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_plan_kind ON partner_subscription_plan(business_kind, is_active);

-- Seed danh mục gói cước chuẩn
INSERT INTO partner_subscription_plan 
(plan_id, business_kind, name, duration_days, price_vnd, original_price_vnd, discount_percent, tagline, badge_label, display_order)
VALUES 
-- RESTAURANT
('REST_PLAN_1_MONTH', 'RESTAURANT', 'Gói Khám Phá (1 Tháng)', 30, 199000, 249000, 20, 'Linh hoạt thử nghiệm & tiếp cận du khách', 'Verified Partner', 1),
('REST_PLAN_3_MONTHS', 'RESTAURANT', 'Gói Tăng Trưởng (3 Tháng)', 90, 499000, 599000, 16, 'Tiết kiệm 16% - Đón đầu mùa du lịch', 'Verified Partner', 2),
('REST_PLAN_1_YEAR', 'RESTAURANT', 'Gói Kim Cương (1 Năm)', 365, 1599000, 2388000, 33, 'Tiết kiệm 33% - Tặng 4 tháng, ưu tiên Top 1', 'Verified Partner', 3),

-- HOTEL
('HOTEL_PLAN_1_MONTH', 'HOTEL', 'Gói Lưu Trú Linh Hoạt (1 Tháng)', 30, 399000, 499000, 20, 'Chỉ bằng 1 đêm phòng bình dân', 'Verified Accommodation', 1),
('HOTEL_PLAN_3_MONTHS', 'HOTEL', 'Gói Mùa Cao Điểm (3 Tháng)', 90, 999000, 1199000, 17, 'Tiết kiệm 17% - Nhận khách đặt phòng trực tiếp', 'Verified Accommodation', 2),
('HOTEL_PLAN_1_YEAR', 'HOTEL', 'Gói Đối Tác Vàng (1 Năm)', 365, 3299000, 4788000, 31, 'Tiết kiệm 31% - Vị trí độc quyền gợi ý lưu trú', 'Verified Accommodation', 3),

-- TOUR GUIDE
('GUIDE_PLAN_1_MONTH', 'TOUR_GUIDE', 'Gói Khởi Nghiệp (1 Tháng)', 30, 149000, 199000, 25, 'Chỉ 5.000đ/ngày xây dựng thương hiệu', 'Verified Local Guide', 1),
('GUIDE_PLAN_3_MONTHS', 'TOUR_GUIDE', 'Gói Chuyên Nghiệp (3 Tháng)', 90, 369000, 449000, 17, 'Tiết kiệm 17% - Nhận tour trực tiếp', 'Verified Local Guide', 2),
('GUIDE_PLAN_1_YEAR', 'TOUR_GUIDE', 'Gói Chuyên Gia Bản Địa (1 Năm)', 365, 1199000, 1788000, 33, 'Tiết kiệm 33% - Kết nối du khách quanh năm', 'Verified Local Guide', 3)
ON CONFLICT (plan_id) DO NOTHING;

-- 2. Bảng theo dõi trạng thái gói thuê bao của từng cơ sở đối tác (partner_business)
CREATE TABLE IF NOT EXISTS partner_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    current_plan_id VARCHAR(50) REFERENCES partner_subscription_plan(plan_id),
    status VARCHAR(30) NOT NULL DEFAULT 'TRIAL', -- 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_partner_subscription_business UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_sub_status_valid_to 
ON partner_subscription(status, valid_to);

-- 3. Bảng lịch sử đơn hàng thanh toán PayOS
CREATE SEQUENCE IF NOT EXISTS partner_payos_order_code_seq START WITH 30000001;

CREATE TABLE IF NOT EXISTS partner_subscription_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code BIGINT NOT NULL UNIQUE DEFAULT nextval('partner_payos_order_code_seq'),
    business_id UUID NOT NULL REFERENCES partner_business(id),
    plan_id VARCHAR(50) NOT NULL REFERENCES partner_subscription_plan(plan_id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'CANCELLED', 'FAILED'
    payos_payment_link_id VARCHAR(100),
    qr_code TEXT,
    payment_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_partner_sub_order_biz 
ON partner_subscription_order(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_sub_order_code 
ON partner_subscription_order(order_code);
