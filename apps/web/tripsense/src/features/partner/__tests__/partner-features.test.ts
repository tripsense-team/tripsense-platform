import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enrollPartner,
  getPartnerContext,
  createBusinessDraft,
  updatePublicationState,
  updateIntakeState,
  revokeContactConsent,
} from "../services/partner-api";
import { apiClient } from "@/services/api-client";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("Partner Frontend API Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls enrollPartner with accepted terms version", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { roles: ["ROLE_USER", "ROLE_PARTNER"] },
    } as any);

    const res = await enrollPartner("1.0");

    expect(apiClient).toHaveBeenCalledWith(
      "/api/users/me/partner-enrollment",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ acceptedTermsVersion: "1.0" }),
      }),
    );
    expect(res.roles).toContain("ROLE_PARTNER");
  });

  it("retrieves partner context and businesses", async () => {
    const mockContext = {
      role: "ROLE_PARTNER",
      businesses: [
        {
          id: "b-1",
          kind: "TOUR_GUIDE",
          displayName: "Hoi An Guide",
          approvalValidity: "VALID",
          operationState: "ACTIVE",
          publicationState: "PUBLISHED",
          acceptingNew: true,
          requiresReverification: false,
          suspensionVersion: 1,
          version: 1,
        },
      ],
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockContext,
    } as any);

    const res = await getPartnerContext();
    expect(apiClient).toHaveBeenCalledWith("/api/partners/businesses", expect.anything());
    expect(res.businesses).toHaveLength(1);
    expect(res.businesses[0].kind).toBe("TOUR_GUIDE");
  });

  it("updates publication state with expected version", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: {
        id: "b-1",
        publicationState: "HIDDEN",
        version: 2,
      },
    } as any);

    const res = await updatePublicationState("b-1", {
      expectedVersion: 1,
      state: "HIDDEN",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/partners/businesses/b-1/publication",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ expectedVersion: 1, state: "HIDDEN" }),
      }),
    );
    expect(res.publicationState).toBe("HIDDEN");
  });

  it("revokes dynamic contact consent with specified channel", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: null,
    } as any);

    await revokeContactConsent("inq-123", {
      channel: "EMAIL",
      reason: "User requested revocation",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/guide-inquiries/inq-123/contact-consents/revoke",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          channel: "EMAIL",
          reason: "User requested revocation",
        }),
      }),
    );
  });

  it("submits admin application review decision with APPROVE / REQUEST_CHANGES / REJECT enum format", async () => {
    const { adminReviewApplication } = await import("../services/partner-api");
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { id: "app-123", state: "APPROVED" },
    } as any);

    await adminReviewApplication("app-123", {
      expectedBusinessVersion: 1,
      expectedApplicationVersion: 2,
      decision: "APPROVE",
      reason: "Hồ sơ đầy đủ tính hợp lệ",
      capabilityDecisions: [{ capability: "HOTEL_LISTING", grant: true }],
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/admin/partner-applications/app-123/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expectedBusinessVersion: 1,
          expectedApplicationVersion: 2,
          decision: "APPROVE",
          reason: "Hồ sơ đầy đủ tính hợp lệ",
          capabilityDecisions: [{ capability: "HOTEL_LISTING", grant: true }],
        }),
      }),
    );
  });

  it("submits admin management claim decision with outcome and reason", async () => {
    const { adminReviewManagementClaim } = await import("../services/partner-api");
    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { id: "claim-123", state: "APPROVED" },
    } as any);

    await adminReviewManagementClaim("claim-123", {
      expectedVersion: 1,
      outcome: "APPROVED",
      reason: "Đủ bằng chứng pháp lý",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/admin/management-claims/claim-123/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 1,
          outcome: "APPROVED",
          reason: "Đủ bằng chứng pháp lý",
        }),
      }),
    );
  });

  it("retrieves and updates restaurant menu with version", async () => {
    const { getRestaurantMenu, updateRestaurantMenu } = await import("../services/partner-api");
    const mockItems = [
      {
        id: "m-1",
        name: "Phở Bò",
        category: "Món chính",
        price: 65000,
        currency: "VND",
        available: true,
        displayOrder: 1,
      },
    ];

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockItems,
    } as any);

    const items = await getRestaurantMenu("biz-rest-1");
    expect(apiClient).toHaveBeenCalledWith(
      "/api/partners/businesses/biz-rest-1/restaurant-menu",
      expect.anything(),
    );
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Phở Bò");

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockItems,
    } as any);

    const updated = await updateRestaurantMenu("biz-rest-1", {
      items: mockItems,
      expectedVersion: 3,
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/partners/businesses/biz-rest-1/restaurant-menu",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ items: mockItems, expectedVersion: 3 }),
      }),
    );
    expect(updated).toHaveLength(1);
  });

  it("updates contact sharing consent and retrieves public restaurant listing", async () => {
    const { updateContactSharing, getPublicRestaurant } = await import("../services/partner-api");

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: null,
    } as any);

    await updateContactSharing("biz-rest-1", {
      expectedVersion: 2,
      publicContactConsent: true,
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/partners/businesses/biz-rest-1/contact-sharing",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ expectedVersion: 2, publicContactConsent: true }),
      }),
    );

    const mockPublicListing = {
      id: "biz-rest-1",
      displayName: "Lantern Kitchen",
      address: "123 Tran Phu, Hoi An",
      destination: "Hoi An",
      menu: [],
      publicPhone: "0901234567",
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockPublicListing,
    } as any);

    const listing = await getPublicRestaurant("biz-rest-1");
    expect(apiClient).toHaveBeenCalledWith(
      "/api/public/restaurants/biz-rest-1",
      expect.anything(),
    );
    expect(listing.displayName).toBe("Lantern Kitchen");
    expect(listing.publicPhone).toBe("0901234567");
  });

  it("creates, cancels, and partner decides restaurant reservation request", async () => {
    const {
      createRestaurantReservation,
      cancelRestaurantReservation,
      decideRestaurantReservation,
    } = await import("../services/partner-api");

    const mockRes = {
      id: "res-123",
      businessId: "biz-rest-1",
      businessName: "Lantern Kitchen",
      customerId: "user-1",
      startAt: "2026-10-20T19:00:00Z",
      timeZone: "Asia/Ho_Chi_Minh",
      adults: 2,
      children: 1,
      state: "REQUESTED",
      version: 0,
      createdAt: "2026-10-13T00:00:00Z",
      updatedAt: "2026-10-13T00:00:00Z",
    };

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: mockRes,
    } as any);

    const created = await createRestaurantReservation(
      "biz-rest-1",
      {
        startAt: "2026-10-20T19:00:00Z",
        timeZone: "Asia/Ho_Chi_Minh",
        adults: 2,
        children: 1,
        notes: "Quiet table",
      },
      "key-123",
    );

    expect(apiClient).toHaveBeenCalledWith(
      "/api/restaurants/biz-rest-1/reservation-requests",
      expect.objectContaining({
        method: "POST",
        headers: { "Idempotency-Key": "key-123" },
      }),
    );
    expect(created.id).toBe("res-123");

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { ...mockRes, state: "CONFIRMED", version: 1 },
    } as any);

    const decided = await decideRestaurantReservation("biz-rest-1", "res-123", {
      expectedVersion: 0,
      decision: "CONFIRM",
      reason: "Table confirmed",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/partners/businesses/biz-rest-1/reservation-requests/res-123/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 0,
          decision: "CONFIRM",
          reason: "Table confirmed",
        }),
      }),
    );
    expect(decided.state).toBe("CONFIRMED");

    vi.mocked(apiClient).mockResolvedValueOnce({
      success: true,
      data: { ...mockRes, state: "CANCELLED", version: 2 },
    } as any);

    const cancelled = await cancelRestaurantReservation("res-123", {
      expectedVersion: 1,
      reason: "Plans changed",
    });

    expect(apiClient).toHaveBeenCalledWith(
      "/api/restaurant-reservation-requests/res-123/cancel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          expectedVersion: 1,
          reason: "Plans changed",
        }),
      }),
    );
    expect(cancelled.state).toBe("CANCELLED");
  });
});
