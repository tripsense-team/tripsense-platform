import { describe, expect, it } from "vitest";
import { approvedAttributionUrl, approvedPhoto, approvedPhotoGallery, getFallbackPlacePhoto, hasFreshPhotoLookup } from "./approved-photo";
import type { Place } from "../types";

const photo = { url: "https://lh3.googleusercontent.com/photo", source: "ziomap",
  attribution: [], fetchedAt: "2026-09-19T00:00:00Z", displayApproved: true };

describe("approvedPhoto", () => {
  it("accepts only approved HTTPS URLs without credentials", () => {
    expect(approvedPhoto(photo)?.url).toBe(photo.url);
    expect(approvedPhoto({ ...photo, displayApproved: false })).toBeNull();
    expect(approvedPhoto({ ...photo, url: "http://example.com/photo" })).toBeNull();
    expect(approvedPhoto({ ...photo, url: "https://example.com/photo?key=secret" })).toBeNull();
    expect(approvedPhoto({ ...photo, url: "https://unapproved.example/photo" })).toBeNull();
  });

  it("links photo authors only through safe HTTPS attribution URLs", () => {
    expect(approvedAttributionUrl("https://example.com/author")).toBe("https://example.com/author");
    expect(approvedAttributionUrl("javascript:alert(1)")).toBeNull();
    expect(approvedAttributionUrl("https://user:pass@example.com/author")).toBeNull();
  });

  it("limits the gallery to five unique approved images and falls back to primary", () => {
    const candidates = [photo, photo, { ...photo, url: "http://unsafe/photo" },
      ...Array.from({ length: 7 }, (_, index) => ({ ...photo, url: `https://lh3.googleusercontent.com/${index}` }))];
    expect(approvedPhotoGallery(candidates, undefined).map((item) => item.url)).toHaveLength(5);
    expect(approvedPhotoGallery([], photo)).toEqual([photo]);
  });

  it("reuses a recent photo lookup but expires its media after five minutes", () => {
    const now = Date.parse("2026-09-19T00:02:00Z");
    const place: Place = { id: "place-1", name: "Cafe", categories: [], photos: [], photoGallery: [photo] };
    expect(hasFreshPhotoLookup(place, now - 60_000, now)).toBe(true);
    expect(hasFreshPhotoLookup(place, now - 5 * 60_000, now)).toBe(false);
    expect(hasFreshPhotoLookup(place, undefined, now)).toBe(false);
  });

  it("accepts unsplash image URLs as approved media hosts", () => {
    const unsplashPhoto = { ...photo, url: "https://images.unsplash.com/photo-123" };
    expect(approvedPhoto(unsplashPhoto)?.url).toBe(unsplashPhoto.url);
  });

  it("returns appropriate fallback photos based on place name keywords", () => {
    const beachPhoto = getFallbackPlacePhoto("Bãi biển Mỹ Khê");
    expect(beachPhoto.url).toContain("images.unsplash.com");
    expect(beachPhoto.displayApproved).toBe(true);

    const bridgePhoto = getFallbackPlacePhoto("Cầu Rồng");
    expect(bridgePhoto.url).toContain("images.unsplash.com");

    const foodPhoto = getFallbackPlacePhoto("Quán Bún Chả Cá");
    expect(foodPhoto.url).toContain("images.unsplash.com");

    const caoLauPhoto = getFallbackPlacePhoto("Mỳ Quảng Cao Lầu Ngon");
    expect(caoLauPhoto.attribution?.[0]?.displayName).toBe("Ẩm thực & Quán ăn địa phương");

    const googleLh5 = { ...photo, url: "https://lh5.googleusercontent.com/place-photos/abc" };
    expect(approvedPhoto(googleLh5)?.url).toBe(googleLh5.url);
  });
});
