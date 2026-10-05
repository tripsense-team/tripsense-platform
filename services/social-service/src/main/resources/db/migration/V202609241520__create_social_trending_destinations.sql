CREATE TABLE IF NOT EXISTS social_trending_destinations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    city_name_key VARCHAR(120) NOT NULL,
    image_url TEXT NOT NULL,
    base_share_count INTEGER NOT NULL DEFAULT 0,
    subtitle VARCHAR(255) NOT NULL,
    subtitle_key VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_trending_destinations_sort_idx
    ON social_trending_destinations (is_active, sort_order ASC);

CREATE INDEX IF NOT EXISTS social_trip_shares_destination_public_idx
    ON social_trip_shares (LOWER(destination_name))
    WHERE visibility = 'PUBLIC' AND removed_at IS NULL;

INSERT INTO social_trending_destinations (id, name, city_name_key, image_url, base_share_count, subtitle, subtitle_key, slug, sort_order, is_active)
VALUES
    ('trend-dalat', 'Đà Lạt', 'destinationDalat', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80', 1420, 'Mùa hoa dã quỳ nở rộ', 'trendSubtitleDalat', 'da-lat', 1, TRUE),
    ('trend-phuquoc', 'Phú Quốc', 'destinationPhuQuoc', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80', 980, 'Hoàng hôn Bãi Sao và lặn biển', 'trendSubtitlePhuQuoc', 'phu-quoc', 2, TRUE),
    ('trend-ninhbinh', 'Ninh Bình', 'destinationNinhBinh', 'https://images.unsplash.com/photo-1528127269322-539801943592?w=600&auto=format&fit=crop&q=80', 760, 'Chèo thuyền sông Ngô Đồng', 'trendSubtitleNinhBinh', 'ninh-binh', 3, TRUE),
    ('trend-sapa', 'Sa Pa', 'destinationSaPa', 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=600&auto=format&fit=crop&q=80', 620, 'Săn mây thung lũng Mường Hoa', 'trendSubtitleSaPa', 'sa-pa', 4, TRUE),
    ('trend-danang', 'Đà Nẵng', 'destinationDaNang', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=600&auto=format&fit=crop&q=80', 510, 'Cầu Vàng Bà Nà Hills', 'trendSubtitleDaNang', 'da-nang', 5, TRUE),
    ('trend-hanoi', 'Hà Nội', 'destinationHaNoi', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80', 430, 'Thu Hà Nội và Phố cổ', 'trendSubtitleHaNoi', 'ha-noi', 6, TRUE)
ON CONFLICT (id) DO NOTHING;
