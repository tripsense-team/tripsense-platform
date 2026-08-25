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
      false
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
      false
    );

    const hrefs = Array.from(popup.querySelectorAll("a"), (link) => link.getAttribute("href"));
    expect(hrefs).not.toContain("javascript:alert(1)");
    expect(hrefs).not.toContain("data:text/html,bad");
    expect(hrefs.some((href) => href?.startsWith("tel:"))).toBe(false);
  });
});
