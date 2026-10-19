import { describe, it, expect } from "vitest";
import {
  POPULAR_DESTINATIONS,
  filterDestinations,
  normalizeDestinationText,
} from "../popular-destinations";

describe("popular-destinations", () => {
  it("contains famous travel cities requested by user", () => {
    const names = POPULAR_DESTINATIONS.map((d) => d.name);
    expect(names).toContain("Singapore");
    expect(names).toContain("Kuala Lumpur");
    expect(names).toContain("New York");
    expect(names).toContain("Đà Nẵng");
    expect(names).toContain("Hà Nội");
  });

  it("normalizes text with diacritics correctly", () => {
    expect(normalizeDestinationText("Đà Nẵng")).toBe("da nang");
    expect(normalizeDestinationText("Hà Nội")).toBe("ha noi");
    expect(normalizeDestinationText("Kuala Lumpur")).toBe("kuala lumpur");
    expect(normalizeDestinationText("NEW YORK")).toBe("new york");
  });

  it("filters destinations regardless of accents or compact spacing", () => {
    const resDaNang = filterDestinations("danang");
    expect(resDaNang.some((d) => d.name === "Đà Nẵng")).toBe(true);

    const resKuala = filterDestinations("kualalumpur");
    expect(resKuala.some((d) => d.name === "Kuala Lumpur")).toBe(true);

    const resNY = filterDestinations("newyork");
    expect(resNY.some((d) => d.name === "New York")).toBe(true);

    const resSing = filterDestinations("singapore");
    expect(resSing.some((d) => d.name === "Singapore")).toBe(true);
  });

  it("filters by region tab correctly", () => {
    const vietnamOnly = filterDestinations("", "vietnam");
    expect(vietnamOnly.every((d) => d.region === "vietnam")).toBe(true);
    expect(vietnamOnly.some((d) => d.name === "Đà Nẵng")).toBe(true);
    expect(vietnamOnly.some((d) => d.name === "Singapore")).toBe(false);

    const asiaOnly = filterDestinations("", "asia");
    expect(asiaOnly.some((d) => d.name === "Singapore")).toBe(true);
    expect(asiaOnly.some((d) => d.name === "Kuala Lumpur")).toBe(true);

    const worldOnly = filterDestinations("", "world");
    expect(worldOnly.some((d) => d.name === "New York")).toBe(true);
    expect(worldOnly.some((d) => d.name === "Paris")).toBe(true);
  });

  it("each destination includes flag, landmark and valid image url", () => {
    for (const dest of POPULAR_DESTINATIONS) {
      expect(dest.flag.length).toBeGreaterThan(0);
      expect(dest.landmark.length).toBeGreaterThan(0);
      expect(dest.image).toMatch(/^https:\/\//);
    }

    const hoiAn = POPULAR_DESTINATIONS.find((d) => d.id === "hoi-an");
    expect(hoiAn?.image).toBe("https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=400&auto=format&fit=crop&q=80");

    const daLat = POPULAR_DESTINATIONS.find((d) => d.id === "da-lat");
    expect(daLat?.image).toBe("https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80");

    const taipei = POPULAR_DESTINATIONS.find((d) => d.id === "taipei");
    expect(taipei?.image).toBe("https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&auto=format&fit=crop&q=80");
  });
});
