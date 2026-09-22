import { describe, expect, it } from "vitest";

import type { Place } from "@/features/places/types";
import { createMapVinaPopup } from "./mapvina-popup";

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1",
    name: "Safe place",
    categories: [],
    photos: [],
    ...overrides,
  };
}

describe("MapVina popup", () => {
  it("renders provider text without interpreting HTML", () => {
    const popup = createMapVinaPopup(
      place({
        name: '<img src=x onerror="alert(1)">',
        address: "<script>alert(1)</script>",
      }),
      false,
    );

    expect(popup.querySelector("img")).toBeNull();
    expect(popup.querySelector("script")).toBeNull();
    expect(popup.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(popup.textContent).toContain("<script>alert(1)</script>");
  });

  it("drops unsafe website, social, and phone links", () => {
    const popup = createMapVinaPopup(
      place({
        website: "javascript:alert(1)",
        socials: ["data:text/html,bad"],
        phone: "123;alert(1)",
      }),
      false,
    );

    const hrefs = Array.from(popup.querySelectorAll("a"), (link) =>
      link.getAttribute("href"),
    );
    expect(hrefs).not.toContain("javascript:alert(1)");
    expect(hrefs).not.toContain("data:text/html,bad");
    expect(hrefs.some((href) => href?.startsWith("tel:"))).toBe(false);
  });

  it("does not show place photos in the map popup", () => {
    const approved = createMapVinaPopup(place({ primaryPhoto: {
      url: "https://lh3.googleusercontent.com/photo-1", source: "ziomap",
      attribution: [{ displayName: "Photo author", uri: "https://example.com/author" }],
      fetchedAt: "2026-09-19T00:00:00Z", displayApproved: true,
    } }), false);
    expect(approved.querySelector("figure img")).toBeNull();

    const unapproved = createMapVinaPopup(place({ primaryPhoto: {
      url: "https://lh3.googleusercontent.com/photo-1", source: "ziomap",
      attribution: [], fetchedAt: "2026-09-19T00:00:00Z", displayApproved: false,
    } }), false);
    expect(unapproved.querySelector("figure img")).toBeNull();
  });
});
