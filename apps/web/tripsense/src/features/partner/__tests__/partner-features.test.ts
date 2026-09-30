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
});
