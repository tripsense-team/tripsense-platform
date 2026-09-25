import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArtifactRenderer } from "./artifact-renderer";
import type { AiArtifact } from "./types";

describe("ArtifactRenderer and Workspace info button integration", () => {
  it("renders info button (ⓘ) on preview cards in ArtifactRenderer", () => {
    const artifact: AiArtifact = {
      artifactId: "art-1",
      schemaVersion: 1,
      version: 1,
      type: "ITINERARY_PREVIEW",
      data: {
        validForPreview: true,
        days: [
          {
            dayNumber: 1,
            date: "2026-09-21",
            items: [
              {
                canonicalPlaceId: "place-1",
                title: "Bún Chả Cá Bà Lữ",
                address: "319 Hùng Vương, Đà Nẵng",
                location: { lat: 16.068, lng: 108.212 },
              },
            ],
          },
        ],
      },
    };

    const handleViewDetails = vi.fn();

    const html = renderToStaticMarkup(
      <ArtifactRenderer
        artifacts={[artifact]}
        selectedPlaceId={null}
        onSelectPlace={() => {}}
        onViewDetails={handleViewDetails}
      />
    );

    expect(html).toContain("Bún Chả Cá Bà Lữ");
    expect(html).toContain("Xem chi tiết địa điểm (ⓘ)");
  });

  it("renders info button on place list cards in ArtifactRenderer", () => {
    const artifact: AiArtifact = {
      artifactId: "art-2",
      schemaVersion: 1,
      version: 1,
      type: "PLACE_LIST",
      data: {
        places: [
          {
            id: "place-2",
            name: "Cầu Rồng Đà Nẵng",
            address: "Nguyễn Văn Linh, Đà Nẵng",
            location: { lat: 16.061, lng: 108.227 },
          },
        ],
      },
    };

    const html = renderToStaticMarkup(
      <ArtifactRenderer
        artifacts={[artifact]}
        selectedPlaceId={null}
        onSelectPlace={() => {}}
        onViewDetails={() => {}}
      />
    );

    expect(html).toContain("Cầu Rồng Đà Nẵng");
    expect(html).toContain("Xem chi tiết địa điểm (ⓘ)");
  });

  it("never renders development fixture places from restored artifacts", () => {
    const artifact: AiArtifact = {
      artifactId: "legacy-fixture-artifact",
      schemaVersion: 1,
      version: 1,
      type: "PLACE_LIST",
      data: {
        places: [
          {
            id: "fixture-son-tra-rating-missing",
            provider: "tripsense-dev-fixture",
            name: "TripSense Test Cafe Mist",
          },
          { id: "real-place", provider: "ziomap", name: "Cafe Du Musee" },
        ],
      },
    };

    const html = renderToStaticMarkup(<ArtifactRenderer artifacts={[artifact]} />);

    expect(html).not.toContain("TripSense Test Cafe Mist");
    expect(html).toContain("Cafe Du Musee");
  });
});
