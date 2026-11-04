import { describe, expect, it } from "vitest";
import { approvedAttributionUrl, approvedPhoto, approvedPhotoGallery, freshApprovedPhotoGallery, hasFreshPhotoLookup } from "./approved-photo";
import type { Place } from "../types";

const photo = {
  url: "https://lh3.googleusercontent.com/photo", source: "ziomap",
  attribution: [], fetchedAt: "2026-09-19T00:00:00Z", displayApproved: true
};

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

  it("keeps durable Cloudinary media after the provider URL TTL", () => {
    const durable = {
      ...photo,
      source: "cloudinary",
      url: "https://res.cloudinary.com/tripsense/image/upload/place-1",
      fetchedAt: "2025-01-01T00:00:00Z",
    };
    expect(
      freshApprovedPhotoGallery(
        { photos: [], photoGallery: [durable], primaryPhoto: durable },
        Date.parse("2026-11-03T00:00:00Z"),
      ),
    ).toEqual([durable]);
  });

  it("does not render expired provider media while a fresh URL is requested", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const place: Place = {
      id: "place-1",
      name: "Cafe",
      categories: [],
      photos: [],
      photoGallery: [
        { ...photo, fetchedAt: "2026-09-24T12:00:00Z" },
      ],
    };

    expect(freshApprovedPhotoGallery(place, now)).toEqual([]);
  });

  it("rejects generic Unsplash images because they are not evidence for a place", () => {
    const unsplashPhoto = { ...photo, url: "https://images.unsplash.com/photo-123" };
    expect(approvedPhoto(unsplashPhoto)).toBeNull();
  });

  it("does not manufacture a gallery when no verified photo exists", () => {
    expect(approvedPhotoGallery([], undefined, [])).toEqual([]);
    const googleLh5 = { ...photo, url: "https://lh5.googleusercontent.com/place-photos/abc" };
    expect(approvedPhoto(googleLh5)?.url).toBe(googleLh5.url);
  });
});
