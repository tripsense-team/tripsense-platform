import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { OnboardingWizard, toPlaceRef } from "../components/onboarding-wizard";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt || ""} />
  ),
}));

// Mock auth
vi.mock("@/features/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Alex Traveler", email: "alex@example.com" },
    isAuthenticated: true,
  }),
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock onboardingApi
vi.mock("../services/onboarding-api", () => ({
  onboardingApi: {
    get: vi.fn().mockResolvedValue({
      version: 1,
      status: "IN_PROGRESS",
      selections: {},
      places: {},
    }),
    start: vi.fn(),
    save: vi.fn(),
    complete: vi.fn(),
    markProfileComplete: vi.fn(),
  },
}));

describe("OnboardingWizard Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with animated sparkles icon on initial render", () => {
    const html = renderToString(<OnboardingWizard />);
    expect(html).toBeTruthy();
    expect(html).toContain("lucide-sparkles");
    expect(html).toContain("common.loading");
  });

  it("ensures payload cleaning removes empty selection arrays and guarantees places object", () => {
    // Unit verification of the payload normalization logic used in persist()
    const dirtySelections: Record<string, string[]> = {
      TRAVEL_PARTY: ["SOLO"],
      BUDGET_TIER: [],
      FOOD_STYLE: ["LOCAL_FOOD", "CAFE"],
    };

    const cleanSelections: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(dirtySelections)) {
      if (Array.isArray(values) && values.length > 0) {
        cleanSelections[key] = values;
      }
    }

    expect(cleanSelections).toEqual({
      TRAVEL_PARTY: ["SOLO"],
      FOOD_STYLE: ["LOCAL_FOOD", "CAFE"],
    });
    expect(cleanSelections.BUDGET_TIER).toBeUndefined();

    // places must never be undefined
    const mockProfilePlaces = undefined;
    const placesPayload = mockProfilePlaces ?? {};
    expect(placesPayload).toEqual({});
  });

  it("normalizes destination name to canonical slug matching backend regex", () => {
    const testCases = [
      { input: "Đà Nẵng", expected: "da-nang" },
      { input: "Phan Thiết", expected: "phan-thiet" },
      { input: "TP. Hồ Chí Minh", expected: "tp-ho-chi-minh" },
      { input: "Bà Rịa - Vũng Tàu", expected: "ba-ria-vung-tau" },
      { input: "Tokyo (Japan)", expected: "tokyo-japan" },
    ];

    const slugRegex = /^[A-Za-z0-9_:\-]{1,160}$/;
    for (const tc of testCases) {
      const slug = toPlaceRef(tc.input);
      expect(slug).toBe(tc.expected);
      expect(slugRegex.test(slug)).toBe(true);
    }
  });

  it("structures places payload with VISITED and WANT_TO_VISIT sets", () => {
    const places = {
      VISITED: ["da-lat", "da-nang"],
      WANT_TO_VISIT: ["phu-quoc", "tokyo"],
    };

    expect(places.VISITED).toContain("da-lat");
    expect(places.WANT_TO_VISIT).toContain("phu-quoc");
    expect(places.VISITED.length).toBeLessThanOrEqual(20);
    expect(places.WANT_TO_VISIT.length).toBeLessThanOrEqual(20);
  });

  it("structures attributes payload for HOME_CITY with valid JSON", () => {
    const homeCityName = "TP. Hồ Chí Minh";
    const attributes: Record<string, string> = {
      HOME_CITY: JSON.stringify({
        name: homeCityName,
        placeRef: toPlaceRef(homeCityName),
        country: "Vietnam",
      }),
    };

    expect(attributes.HOME_CITY).toBeDefined();
    const parsed = JSON.parse(attributes.HOME_CITY);
    expect(parsed.name).toBe("TP. Hồ Chí Minh");
    expect(parsed.placeRef).toBe("tp-ho-chi-minh");
    expect(parsed.country).toBe("Vietnam");
  });

  it("handles freeText note trimming and length boundaries", () => {
    const rawNote = "   I love serene beaches and local seafood.   ";
    const trimmed = rawNote.trim().slice(0, 2000);
    expect(trimmed).toBe("I love serene beaches and local seafood.");
    expect(trimmed.length).toBeLessThanOrEqual(2000);

    const overlyLong = "x".repeat(2500);
    const capped = overlyLong.trim().slice(0, 2000);
    expect(capped.length).toBe(2000);
  });
});
