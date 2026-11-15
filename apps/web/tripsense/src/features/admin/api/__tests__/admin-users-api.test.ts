import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/api-client";
import {
  fetchAdminUsers,
  fetchAdminUserTripCounts,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../admin-users-api";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("admin users API", () => {
  beforeEach(() => {
    vi.mocked(apiClient).mockReset();
  });

  it("queries paginated and filtered admin users from user-service", async () => {
    vi.mocked(apiClient).mockResolvedValue({
      success: true,
      data: {
        items: [],
        page: 1,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        summary: { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, unverifiedUsers: 0 },
      },
    });

    await fetchAdminUsers({
      page: 1,
      size: 20,
      search: "alex@tripsense.app",
      role: "PARTNER",
      status: "ACTIVE",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/users/admin/users?page=1&size=20&search=alex%40tripsense.app&role=PARTNER&status=ACTIVE",
      { method: "GET", cache: "no-store" },
    );
  });

  it("fetches trip counts in batch and gracefully falls back to null on error", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { counts: { "u-1": 5, "u-2": 0 } },
    });

    const counts = await fetchAdminUserTripCounts(["u-1", "u-2"]);
    expect(counts).toEqual({ "u-1": 5, "u-2": 0 });

    vi.mocked(apiClient).mockRejectedValueOnce(new Error("trip-service unavailable"));
    const fallback = await fetchAdminUserTripCounts(["u-1"]);
    expect(fallback).toBeNull();
  });

  it("sends PATCH requests for status and role updates", async () => {
    vi.mocked(apiClient).mockResolvedValue({ success: true, data: { id: "u-1" } });

    await updateAdminUserStatus("u-1", "INACTIVE");
    expect(apiClient).toHaveBeenNthCalledWith(1, "/api/users/admin/users/u-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "INACTIVE" }),
    });

    await updateAdminUserRole("u-1", "ADMIN");
    expect(apiClient).toHaveBeenNthCalledWith(2, "/api/users/admin/users/u-1/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "ADMIN" }),
    });
  });
});

