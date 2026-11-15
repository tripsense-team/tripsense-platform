import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n";
import {
  PlacePhotoFallback,
  resolvePlaceVisualTheme,
} from "./place-photo-fallback";
import { PlacePhotoGallery } from "./place-photo-gallery";

describe("PlacePhotoFallback", () => {
  it("resolves theme cleanly from primaryType first and skips generic tags", () => {
    expect(
      resolvePlaceVisualTheme(undefined, [
        "point_of_interest",
        "establishment",
        "cafe",
      ]),
    ).toBe("cafe");
    expect(
      resolvePlaceVisualTheme("tourist_attraction", [
        "food",
        "point_of_interest",
      ]),
    ).toBe("heritage");
    expect(
      resolvePlaceVisualTheme(undefined, ["beach", "point_of_interest"]),
    ).toBe("beach");
    expect(resolvePlaceVisualTheme("homestay", ["lodging"])).toBe("stay");
    expect(resolvePlaceVisualTheme(undefined, ["nhà hàng", "hải sản"])).toBe(
      "dining",
    );
    expect(
      resolvePlaceVisualTheme(undefined, [
        "point_of_interest",
        "establishment",
      ]),
    ).toBe("explore");
  });

  it("renders localized category label and honest no-licensed-photo caption without external stock URLs", () => {
    const htmlVi = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlacePhotoFallback categories={["quán cafe"]} variant="card" />
      </I18nProvider>,
    );
    expect(htmlVi).toContain('data-fallback-theme="cafe"');
    expect(htmlVi).toContain("Cà phê &amp; Đồ uống");
    expect(htmlVi).toContain("Chưa có ảnh được cấp phép");
    expect(htmlVi).not.toContain("images.unsplash.com");

    const htmlEn = renderToStaticMarkup(
      <I18nProvider initialLocale="en">
        <PlacePhotoFallback primaryType="beach" variant="gallery" />
      </I18nProvider>,
    );
    expect(htmlEn).toContain('data-fallback-theme="beach"');
    expect(htmlEn).toContain("Coast &amp; Nature");
    expect(htmlEn).toContain("No licensed photos available");
  });

  it("uses category fallback in PlacePhotoGallery when idle with no photos and preserves loading indicator", () => {
    const idleHtml = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlacePhotoGallery
          place={{
            id: "1",
            name: "Bãi biển Mỹ Khê",
            categories: ["beach"],
            photos: [],
          }}
          loading={false}
        />
      </I18nProvider>,
    );
    expect(idleHtml).toContain('data-fallback-theme="beach"');
    expect(idleHtml).toContain("Biển &amp; Thiên nhiên");

    const loadingHtml = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PlacePhotoGallery
          place={{
            id: "1",
            name: "Bãi biển Mỹ Khê",
            categories: ["beach"],
            photos: [],
          }}
          loading={true}
        />
      </I18nProvider>,
    );
    expect(loadingHtml).toContain("Đang tải ảnh địa điểm...");
  });
});
