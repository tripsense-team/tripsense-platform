-- 1. Bảng lưu trữ các Địa điểm được đề xuất (Options)
CREATE TABLE IF NOT EXISTS trip_destination_options (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL,
    place_id UUID,
    name VARCHAR(255) NOT NULL,
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_destination_options_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Đánh Index để tăng tốc độ query danh sách option theo trip
CREATE INDEX IF NOT EXISTS idx_destination_options_trip_id ON trip_destination_options(trip_id);

-- 2. Bảng lưu trữ Lượt bình chọn (Votes)
CREATE TABLE IF NOT EXISTS trip_destination_votes (
    id UUID PRIMARY KEY,
    trip_destination_option_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_destination_votes_option FOREIGN KEY (trip_destination_option_id) REFERENCES trip_destination_options(id) ON DELETE CASCADE,
    -- Đảm bảo 1 user không thể vote 2 lần cho cùng 1 option
    CONSTRAINT uk_destination_votes_option_user UNIQUE (trip_destination_option_id, user_id)
);

-- Đánh Index để đếm tổng số vote siêu nhanh
CREATE INDEX IF NOT EXISTS idx_destination_votes_option_id ON trip_destination_votes(trip_destination_option_id);
