import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api-client";
import { fetchAdminReviews, updateAdminReviewStatus } from "../admin-reviews-api";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("admin reviews API", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
  });

  it("queries paginated and filtered place reviews from social-service", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: {
        items: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        summary: { total: 0, published: 0, removed: 0, flagged: 0 },
      },
    });

    await fetchAdminReviews({
      page: 0,
      size: 20,
      search: "dragon bridge",
      status: "FLAGGED",
      rating: 5,
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/social/admin/reviews?page=0&size=20&search=dragon+bridge&status=FLAGGED&rating=5",
      { method: "GET", cache: "no-store" },
    );
  });

  it("sends PATCH request to moderate review status with version", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: { id: "rev-1", status: "REMOVED", pendingReportCount: 0, version: 3 },
    });

    await updateAdminReviewStatus("rev-1", "REMOVED", { reason: "Spam", version: 2 });

    expect(apiClient).toHaveBeenCalledWith("/api/social/admin/reviews/rev-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "REMOVED", reason: "Spam", version: 2 }),
    });
  });
});

