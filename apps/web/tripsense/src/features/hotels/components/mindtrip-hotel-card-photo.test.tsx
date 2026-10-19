import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import type { PlaceDetailsResponse } from "@/features/places/types";

const { getPlaceDetails } = vi.hoisted(() => ({ getPlaceDetails: vi.fn() }));
vi.mock("@/features/places/services/places-api", () => ({ getPlaceDetails }));

import { MindtripHotelCard } from "./mindtrip-hotel-card";
import type { MindtripHotel } from "../types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let observerCallback: IntersectionObserverCallback | undefined;
class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  root = null;
  rootMargin = "200px";
  thresholds = [0];
}

const hotel: MindtripHotel = {
  id: "samdi-place-test",
  placeId: "samdi-place-test",
  name: "Hotel Samdi",
  category: "Hotel",
  destination: "Da Nang",
  photos: [],
};

let container: HTMLDivElement;
let root: Root;
const originalObserver = globalThis.IntersectionObserver;

describe("MindtripHotelCard photo enrichment", () => {
  beforeEach(() => {
    observerCallback = undefined;
    globalThis.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
    getPlaceDetails.mockReset();
    const response: PlaceDetailsResponse = {
      success: true,
      data: {
        id: hotel.id,
        name: hotel.name,
        categories: ["Hotel"],
        photos: [],
        photoGallery: [{
          url: "https://lh3.googleusercontent.com/samdi-live-photo",
          source: "google",
          attribution: [],
          fetchedAt: new Date().toISOString(),
          displayApproved: true,
        }],
      },
    };
    getPlaceDetails.mockResolvedValue(response);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.IntersectionObserver = originalObserver;
  });

  it("loads the approved photo only after the card enters the visible area", async () => {
    act(() => {
      root.render(<I18nProvider initialLocale="vi"><MindtripHotelCard hotel={hotel} /></I18nProvider>);
    });

    expect(getPlaceDetails).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Chưa có ảnh được cấp phép");

    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      await Promise.resolve();
    });

    expect(getPlaceDetails).toHaveBeenCalledWith(hotel.placeId, hotel.name, undefined, undefined, undefined, true);
    expect(container.querySelector('img[src="https://lh3.googleusercontent.com/samdi-live-photo"]')).not.toBeNull();
  });
});
