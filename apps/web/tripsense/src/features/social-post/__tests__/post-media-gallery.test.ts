import { describe, it, expect } from "vitest";

describe("Post Media Gallery & Asymmetric Mosaic Grid Logic", () => {
  it("computes correct layout category for various image counts", () => {
    const getLayoutType = (mediaUrls?: string[]) => {
      if (!mediaUrls || mediaUrls.length === 0) return "none";
      if (mediaUrls.length === 1) return "single";
      if (mediaUrls.length === 2) return "pair";
      if (mediaUrls.length === 3) return "trio-asymmetric";
      return "mosaic-asymmetric-with-badge";
    };

    expect(getLayoutType(undefined)).toBe("none");
    expect(getLayoutType([])).toBe("none");
    expect(getLayoutType(["img1.jpg"])).toBe("single");
    expect(getLayoutType(["img1.jpg", "img2.jpg"])).toBe("pair");
    expect(getLayoutType(["img1.jpg", "img2.jpg", "img3.jpg"])).toBe(
      "trio-asymmetric",
    );
    expect(
      getLayoutType(["img1.jpg", "img2.jpg", "img3.jpg", "img4.jpg"]),
    ).toBe("mosaic-asymmetric-with-badge");
    expect(
      getLayoutType([
        "img1.jpg",
        "img2.jpg",
        "img3.jpg",
        "img4.jpg",
        "img5.jpg",
      ]),
    ).toBe("mosaic-asymmetric-with-badge");
  });

  it("calculates remaining overlay badge count correctly for 4+ images", () => {
    const getRemainingCount = (totalCount: number) => {
      return totalCount > 3 ? totalCount - 3 : 0;
    };

    expect(getRemainingCount(3)).toBe(0);
    expect(getRemainingCount(4)).toBe(1); // +1 ảnh
    expect(getRemainingCount(5)).toBe(2); // +2 ảnh (matching test.html)
    expect(getRemainingCount(8)).toBe(5); // +5 ảnh
  });

  it("cycles previous and next indexes correctly in lightbox carousel", () => {
    const total = 5;

    const getNextIndex = (current: number) =>
      current < total - 1 ? current + 1 : 0;
    const getPrevIndex = (current: number) =>
      current > 0 ? current - 1 : total - 1;

    // Forward cycle
    expect(getNextIndex(0)).toBe(1);
    expect(getNextIndex(3)).toBe(4);
    expect(getNextIndex(4)).toBe(0); // Loops back to start

    // Backward cycle
    expect(getPrevIndex(4)).toBe(3);
    expect(getPrevIndex(1)).toBe(0);
    expect(getPrevIndex(0)).toBe(4); // Loops to end
  });

  it("clamps initial index within safe boundaries", () => {
    const total = 3;
    const clampIndex = (initial: number) =>
      Math.max(0, Math.min(initial, total - 1));

    expect(clampIndex(-1)).toBe(0);
    expect(clampIndex(1)).toBe(1);
    expect(clampIndex(2)).toBe(2);
    expect(clampIndex(99)).toBe(2);
  });
});
