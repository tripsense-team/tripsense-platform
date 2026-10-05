import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlacePhotoGallery } from "./place-photo-gallery";
import type { Place, PlacePhotoEvidence } from "../types";

const photo = (index: number): PlacePhotoEvidence => ({
  url: `https://lh3.googleusercontent.com/photo-${index}`,
  source: "ziomap",
  attribution: [{ displayName: `Tác giả ${index}`, uri: "https://example.com/author" }],
  fetchedAt: "2026-09-19T00:00:00Z",
  displayApproved: true,
});

const place: Place = { id: "canonical-1", name: "Bún Chả Cá Bà Lữ", categories: [], photos: [] };

describe("PlacePhotoGallery", () => {
  it("renders one hero and four supporting photos without copyright badge overlays", () => {
    const html = renderToStaticMarkup(<PlacePhotoGallery place={{ ...place,
      primaryPhoto: photo(1), photoGallery: Array.from({ length: 7 }, (_, index) => photo(index + 1)),
    }} loading={false} />);
    expect(html.match(/alt="Bún Chả Cá Bà Lữ — ảnh /g)).toHaveLength(5);
    expect(html).toContain("grid-cols-2 grid-rows-2");
    expect(html).not.toContain("©");
    expect(html).not.toContain("Tác giả");
  });

  it("renders photos from place.photos string array when photoGallery is not present", () => {
    const html = renderToStaticMarkup(<PlacePhotoGallery place={{ ...place,
      photos: ["https://lh3.googleusercontent.com/photo-1", "https://lh3.googleusercontent.com/photo-2"],
    }} loading={false} />);
    expect(html.match(/alt="Bún Chả Cá Bà Lữ — ảnh /g)).toHaveLength(2);
    expect(html).not.toContain("©");
  });

  it("shows a truthful fallback when no approved photo exists", () => {
    const html = renderToStaticMarkup(<PlacePhotoGallery place={{ ...place,
      photoGallery: [{ ...photo(1), displayApproved: false }],
    }} loading={false} />);
    expect(html).toContain("Chưa có ảnh được cấp phép");
    expect(html).not.toContain("photo-1");
  });
});
