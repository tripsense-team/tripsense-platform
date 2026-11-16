import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdminReviews } from "../../api/admin-reviews-api";
import { fetchAdminTrips, fetchTripCreatorProfiles } from "../../api/admin-trips-api";
import { AdminReviewsView } from "../admin-reviews-view";
import { AdminTripsView } from "../admin-trips-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

vi.mock("../../api/admin-reviews-api", () => ({
  fetchAdminReviews: vi.fn(),
  updateAdminReviewStatus: vi.fn(),
}));

vi.mock("../../api/admin-trips-api", () => ({
  fetchAdminTrips: vi.fn(),
  fetchTripCreatorProfiles: vi.fn(),
  updateAdminTripArchive: vi.fn(),
}));

describe("AdminReviewsView and AdminTripsView", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.mocked(fetchAdminReviews).mockReset();
    vi.mocked(fetchAdminTrips).mockReset();
    vi.mocked(fetchTripCreatorProfiles).mockReset();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("renders Neon DB place reviews with flagged badge and switches status filters", async () => {
    vi.mocked(fetchAdminReviews).mockResolvedValue({
      items: [
        {
          id: "rev-1",
          placeRef: "place-dragon",
          placeName: "Dragon Bridge",
          authorUserId: "user-1",
          authorName: "Hue Phan",
          authorAvatarUrl: null,
          rating: 5,
          content: "Awesome fire show on weekends",
          status: "PUBLISHED",
          pendingReportCount: 2,
          totalReportCount: 2,
          version: 1,
          createdAt: "2026-11-10T09:00:00Z",
          updatedAt: "2026-11-10T09:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      summary: { total: 5, published: 4, removed: 1, flagged: 1 },
    });

    await act(async () => {
      root.render(<AdminReviewsView />);
    });

    expect(host.textContent).toContain("Hue Phan");
    expect(host.textContent).toContain("Dragon Bridge");
    expect(host.textContent).toContain("Awesome fire show on weekends");
    expect(host.textContent).toContain('admin.reviews.flaggedBadge:{"count":2}');

    const flaggedBtn = [...host.querySelectorAll("button")].find(
      (btn) => btn.textContent === "admin.reviews.status.flagged",
    );
    expect(flaggedBtn).toBeTruthy();

    await act(async () => {
      flaggedBtn?.click();
    });

    expect(fetchAdminReviews).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, status: "FLAGGED" }),
    );
  });

  it("renders Neon DB trips enriched with creator profiles and visibility filters", async () => {
    vi.mocked(fetchAdminTrips).mockResolvedValue({
      items: [
        {
          id: "trip-1",
          ownerUserId: "11111111-2222-3333-4444-555555555555",
          name: "Da Nang Retreat",
          destinationName: "Da Nang, Vietnam",
          startDate: "2026-12-01",
          endDate: "2026-12-03",
          durationDays: 3,
          status: "CONFIRMED",
          visibility: "PUBLIC",
          travelerCount: 2,
          spotsCount: 6,
          isAiGenerated: true,
          archived: false,
          archivedAt: null,
          version: 2,
          createdAt: "2026-11-10T08:00:00Z",
          updatedAt: "2026-11-10T08:00:00Z",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      summary: {
        totalTrips: 9,
        activeTrips: 8,
        archivedTrips: 1,
        aiCraftedTrips: 6,
        publicTrips: 4,
      },
    });
    vi.mocked(fetchTripCreatorProfiles).mockResolvedValue({
      "11111111-2222-3333-4444-555555555555": {
        userId: "11111111-2222-3333-4444-555555555555",
        displayName: "Gia Bao",
        avatarUrl: null,
      },
    });

    await act(async () => {
      root.render(<AdminTripsView />);
    });

    expect(host.textContent).toContain("Da Nang Retreat");
    expect(host.textContent).toContain("Da Nang, Vietnam");
    expect(host.textContent).toContain("Gia Bao");
    expect(host.textContent).toContain("admin.trips.aiCrafted");

    const publicBtn = [...host.querySelectorAll("button")].find(
      (btn) => btn.textContent === "admin.trips.visibility.public",
    );
    expect(publicBtn).toBeTruthy();

    await act(async () => {
      publicBtn?.click();
    });

    expect(fetchAdminTrips).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, visibility: "PUBLIC" }),
    );
  });
});

