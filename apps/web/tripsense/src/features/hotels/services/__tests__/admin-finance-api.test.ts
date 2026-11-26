import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock("@/services/api-client", () => ({
  apiClient: mockApiClient,
}));

import { fetchAdminSubscriptionOrders } from "../admin-finance-api";

describe("fetchAdminSubscriptionOrders", () => {
  beforeEach(() => {
    mockApiClient.mockReset();
  });

  it("omits ALL filters and unwraps ApiResponse data", async () => {
    mockApiClient.mockResolvedValueOnce({
      success: true,
      data: {
        items: [
          {
            id: "ord-1",
            orderCode: 30000012,
            businessId: "biz-1",
            businessName: "Sunrise Hotel",
            businessKind: "HOTEL",
            planId: "HOTEL_PLAN_1_MONTH",
            planName: "Gói Lưu Trú Linh Hoạt",
            durationDays: 30,
            amount: 399000,
            paymentStatus: "PAID",
            paidAt: "2026-11-20T08:15:00Z",
            createdAt: "2026-11-20T08:12:00Z",
          },
        ],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
      },
    });

    const result = await fetchAdminSubscriptionOrders({
      status: "ALL",
      businessKind: "ALL",
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/admin/finance/subscription-orders?page=0&size=50",
      { method: "GET", cache: "no-store" },
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].orderCode).toBe(30000012);
  });

  it("passes status and businessKind filters when specified", async () => {
    mockApiClient.mockResolvedValueOnce({
      items: [],
      page: 1,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });

    await fetchAdminSubscriptionOrders({
      status: "PAID",
      businessKind: "RESTAURANT",
      page: 1,
      size: 20,
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/admin/finance/subscription-orders?status=PAID&businessKind=RESTAURANT&page=1&size=20",
      { method: "GET", cache: "no-store" },
    );
  });
});

