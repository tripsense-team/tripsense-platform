import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MindtripPlaceCard } from "./mindtrip-place-card";
import { I18nProvider } from "@/i18n";
import type { Place } from "../types";

const mockPlace: Place = {
  id: "test-place-1",
  name: "BÁNH GÁNH 2 - Cơm Niêu & Đặc Sản Huế",
  rating: 4.8,
  userRatingCount: 1000,
  categories: ["vietnamese_restaurant", "food"],
  district: "Huế",
  city: "Thừa Thiên Huế",
  photos: [
    "https://lh3.googleusercontent.com/p/photo1.jpg",
    "https://lh3.googleusercontent.com/p/photo2.jpg",
    "https://lh3.googleusercontent.com/p/photo3.jpg",
  ],
};

describe("MindtripPlaceCard", () => {
  it("renders place details in English when locale is en", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripPlaceCard place={mockPlace} onViewDetails={() => {}} />
      </I18nProvider>
    );

    expect(html).toContain("BÁNH GÁNH 2 - Cơm Niêu &amp; Đặc Sản Huế");
    expect(html).toContain("4.8");
    expect(html).toContain("(1k)");
    expect(html).toContain("vietnamese restaurant");
    expect(html).toContain("Huế, Thừa Thiên Huế");
    expect(html).toContain("$$");
    expect(html).toContain('aria-label="Save Place"');
    expect(html).toContain('aria-label="Add to trip"');
    expect(html).toContain('aria-label="View details"');
    expect(html).toContain('aria-label="Previous photo"');
    expect(html).toContain('aria-label="Next photo"');
    expect(html).toContain("rounded-2xl");
  });

  it("renders place details in Vietnamese when locale is vi matching Mindtrip screenshot format", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <MindtripPlaceCard place={mockPlace} onViewDetails={() => {}} />
      </I18nProvider>
    );

    expect(html).toContain("BÁNH GÁNH 2 - Cơm Niêu &amp; Đặc Sản Huế");
    expect(html).toContain("4,8");
    expect(html).toContain("(1 n)");
    expect(html).toContain("Huế, Thừa Thiên Huế");
    expect(html).toContain("$$");
    expect(html).toContain('aria-label="Lưu địa điểm"');
    expect(html).toContain('aria-label="Thêm vào chuyến đi"');
    expect(html).toContain('aria-label="Xem chi tiết"');
  });

  it("renders pagination dots and arrow navigation buttons when multiple photos exist", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripPlaceCard place={mockPlace} />
      </I18nProvider>
    );
    // mockPlace has 3 photos, should render active dot and arrows
    expect(html).toContain("w-2.5 bg-white");
    expect(html).toContain('aria-label="Previous photo"');
    expect(html).toContain('aria-label="Next photo"');
  });

  it("shows an empty photo state instead of an unrelated stock image", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <MindtripPlaceCard
          place={{ ...mockPlace, photos: [], photoGallery: [], primaryPhoto: undefined }}
        />
      </I18nProvider>
    );

    expect(html).toContain("No licensed photos available");
    expect(html).not.toContain("images.unsplash.com");
    expect(html).not.toContain("Previous photo");
    expect(html).not.toContain("Next photo");
  });
});
