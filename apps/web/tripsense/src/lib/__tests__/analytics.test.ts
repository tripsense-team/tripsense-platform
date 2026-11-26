import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendGAEvent } = vi.hoisted(() => ({
  mockSendGAEvent: vi.fn(),
}));

vi.mock("@next/third-parties/google", () => ({
  sendGAEvent: mockSendGAEvent,
}));

import { getGaMeasurementId, trackEvent } from "../analytics";

describe("analytics", () => {
  const originalEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  beforeEach(() => {
    mockSendGAEvent.mockReset();
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalEnv;
    }
  });

  it("returns undefined when NEXT_PUBLIC_GA_MEASUREMENT_ID is missing or blank", () => {
    expect(getGaMeasurementId()).toBeUndefined();
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "   ";
    expect(getGaMeasurementId()).toBeUndefined();
  });

  it("returns trimmed Measurement ID when configured", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = " G-MBQ07YCLV8 ";
    expect(getGaMeasurementId()).toBe("G-MBQ07YCLV8");
  });

  it("no-ops when GA Measurement ID is not configured", () => {
    trackEvent("login", { method: "email" });
    expect(mockSendGAEvent).not.toHaveBeenCalled();
  });

  it("dispatches standardized non-PII GA4 event when configured", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-MBQ07YCLV8";
    trackEvent("view_place", {
      place_id: "place_123",
      category: "restaurant",
      city: "Da Nang",
    });
    expect(mockSendGAEvent).toHaveBeenCalledWith("event", "view_place", {
      place_id: "place_123",
      category: "restaurant",
      city: "Da Nang",
    });
  });

  it("swallows sendGAEvent errors so user flows never break", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-MBQ07YCLV8";
    mockSendGAEvent.mockImplementationOnce(() => {
      throw new Error("gtag unavailable");
    });
    expect(() =>
      trackEvent("send_ai_prompt", { has_trip_context: true }),
    ).not.toThrow();
  });
});

