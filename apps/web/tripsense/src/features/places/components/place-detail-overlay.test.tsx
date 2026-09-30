import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlaceDetailOverlay } from "./place-detail-overlay";
import { I18nProvider } from "@/i18n";
import type { Place } from "../types";
vi.mock("@/features/community-reviews", () => ({
  CommunityReviewsSection: () => <div>Community reviews</div>,
}));

const mockPlace: Place = {
  id: "test-place-detail-1",
  name: "BÁNH GÁNH 2 - Cơm Niêu & Đặc Sản Huế",
  rating: 4.8,
  userRatingCount: 1000,
  categories: ["vietnamese_restaurant"],
  district: "Phú Xuân",
  city: "Huế",
  address: "47 Đ. Ông Ích Khiêm, Phú Xuân, Huế 53000, Vietnam",
  phone: "+84 914 006 847",
  website: "https://banhganh2.com",
  photos: [
    "https://lh3.googleusercontent.com/p/photo1.jpg",
    "https://lh3.googleusercontent.com/p/photo2.jpg",
    "https://lh3.googleusercontent.com/p/photo3.jpg",
    "https://lh3.googleusercontent.com/p/photo4.jpg",
    "https://lh3.googleusercontent.com/p/photo5.jpg",
  ],
};

describe("PlaceDetailOverlay", () => {
  it("renders place header, 5-photo mosaic, and tabs in Vietnamese locale", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay place={mockPlace} onClose={() => {}} />
      </I18nProvider>
    );

    // Title
    expect(html).toContain("BÁNH GÁNH 2 - Cơm Niêu &amp; Đặc Sản Huế");
    // Rating & Review count in Vietnamese format
    expect(html).toContain("4,8");
    expect(html).toContain("1 n");
    expect(html).toContain("Phú Xuân, Huế");
    // Top Action Buttons
    expect(html).toContain('aria-label="Đóng"');
    expect(html).toContain("Lưu");
    expect(html).toContain("Thêm vào chuyến đi");
    expect(html).toContain('aria-label="Chỉ đường"');
    expect(html).toContain('aria-label="Nghe thuyết minh"');
    expect(html).toContain('aria-label="Chia sẻ"');
    // Navigation Tabs
    expect(html).toContain("Overview");
    expect(html).toContain("Reviews");
    expect(html).toContain("Location");
    // Metadata
    expect(html).toContain("47 Đ. Ông Ích Khiêm, Phú Xuân, Huế 53000, Vietnam");
    expect(html).toContain("Get directions");
    expect(html).toContain("banhganh2.com");
    expect(html).toContain("+84 914 006 847");
  });

  it("renders panel collapse and expand buttons when onTogglePanel is provided", () => {
    const htmlCollapsed = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay
          place={mockPlace}
          isPanelCollapsed={true}
          onTogglePanel={() => {}}
          onClose={() => {}}
        />
      </I18nProvider>
    );
    expect(htmlCollapsed).toContain('aria-label="Hiện danh sách"');

    const htmlExpanded = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay
          place={mockPlace}
          isPanelCollapsed={false}
          onTogglePanel={() => {}}
          onClose={() => {}}
        />
      </I18nProvider>
    );
    expect(htmlExpanded).toContain('aria-label="Thu gọn danh sách"');
  });

  it("renders active Save and Added states", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay
          place={mockPlace}
          isFavorite={true}
          isAddedToTrip={true}
          onClose={() => {}}
        />
      </I18nProvider>
    );

    expect(html).toContain("Đã lưu");
    expect(html).toContain("Đã thêm vào chuyến đi");
  });

  it("renders continuous scroll layout with overview, reviews, and location sections simultaneously", () => {
    const placeWithReviews: Place = {
      ...mockPlace,
      reviews: [
        {
          authorName: "Nguyễn Văn A",
          rating: 5,
          text: "Món ăn rất ngon, phục vụ chu đáo tận tình!",
          relativeTimeDescription: "2 tuần trước",
        },
        {
          authorName: "Trần Thị B",
          rating: 4,
          text: "Không gian thoáng mát, đồ ăn đậm đà vị Huế.",
          relativeTimeDescription: "1 tháng trước",
        },
      ],
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay place={placeWithReviews} onClose={() => {}} />
      </I18nProvider>
    );

    // Continuous scroll sections all present on the same page
    expect(html).toContain('id="section-overview"');
    expect(html).toContain('id="section-reviews"');
    expect(html).toContain('id="section-location"');

    // Reviews list rendered
    expect(html).toContain("Nguyễn Văn A");
    expect(html).toContain("Món ăn rất ngon, phục vụ chu đáo tận tình!");
    expect(html).toContain("2 tuần trước");
    expect(html).toContain("Trần Thị B");
    expect(html).toContain("Không gian thoáng mát, đồ ăn đậm đà vị Huế.");
    expect(html).toContain("1 tháng trước");
  });

  it("does not pad a partial gallery with stock or duplicate photos", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <PlaceDetailOverlay
          place={{ ...mockPlace, photos: mockPlace.photos?.slice(0, 2) }}
          onClose={() => {}}
        />
      </I18nProvider>
    );

    expect(html.match(/photo1\.jpg/g)).toHaveLength(1);
    expect(html.match(/photo2\.jpg/g)).toHaveLength(1);
    expect(html).not.toContain("images.unsplash.com");
  });

  it("shows an honest empty state when no verified photo exists", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlaceDetailOverlay
          place={{ ...mockPlace, photos: [], photoGallery: [], primaryPhoto: undefined }}
          onClose={() => {}}
        />
      </I18nProvider>
    );

    expect(html).toContain("Chưa có ảnh được cấp phép");
    expect(html).not.toContain("images.unsplash.com");
  });
});
