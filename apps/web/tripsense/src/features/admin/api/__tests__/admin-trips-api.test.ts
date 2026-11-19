import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api-client";
import {
  fetchAdminTrips,
  fetchTripCreatorProfiles,
  updateAdminTripArchive,
} from "../admin-trips-api";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("admin trips API", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
  });

  it("queries paginated and filtered trips from trip-service", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: {
        items: [],
        page: 1,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        summary: {
          totalTrips: 0,
          activeTrips: 0,
          archivedTrips: 0,
          aiCraftedTrips: 0,
          publicTrips: 0,
        },
      },
    });

    await fetchAdminTrips({
      page: 1,
      size: 20,
      search: "Da Nang",
      visibility: "PUBLIC",
      archived: "ACTIVE",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/admin/trips?page=1&size=20&search=Da+Nang&visibility=PUBLIC&archived=ACTIVE",
      { method: "GET", cache: "no-store" },
    );
  });

  it("batch resolves creator public profiles and falls back cleanly on error", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: [
        { userId: "u-1", displayName: "Hue Phan", avatarUrl: null },
        { userId: "u-2", displayName: "Alex", avatarUrl: "https://example.com/a.png" },
      ],
    });

    const profiles = await fetchTripCreatorProfiles(["u-1", "u-1", "u-2"]);
    expect(apiClient).toHaveBeenCalledWith("/api/users/public-profiles:batch", {
      method: "POST",
      body: JSON.stringify({ userIds: ["u-1", "u-2"] }),
      cache: "no-store",
    });
    expect(profiles).toEqual({
      "u-1": { userId: "u-1", displayName: "Hue Phan", avatarUrl: null },
      "u-2": { userId: "u-2", displayName: "Alex", avatarUrl: "https://example.com/a.png" },
    });

    vi.mocked(apiClient).mockRejectedValueOnce(new Error("user-service down"));
    const fallback = await fetchTripCreatorProfiles(["u-1"]);
    expect(fallback).toBeNull();
  });

  it("sends PATCH request to toggle trip archive state", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: { id: "t-1", status: "ARCHIVED", archived: true, version: 5 },
    });

    await updateAdminTripArchive("t-1", true, 4);

    expect(apiClient).toHaveBeenCalledWith("/api/admin/trips/t-1/archive", {
      method: "PATCH",
      body: JSON.stringify({ archived: true, version: 4 }),
    });
  });
});

