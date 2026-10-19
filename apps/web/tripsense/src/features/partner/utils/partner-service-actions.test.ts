import { describe, expect, it } from "vitest";
import { getPartnerServiceActions } from "./partner-service-actions";
import type { BusinessDetailDto } from "../types";

const business = (overrides: Partial<BusinessDetailDto>): BusinessDetailDto => ({
  id: "business/1",
  kind: "RESTAURANT",
  ownerUserId: "user-1",
  displayName: "Test business",
  approvalValidity: "VALID",
  operationState: "ACTIVE",
  publicationState: "PUBLISHED",
  acceptingNew: true,
  requiresReverification: false,
  suspensionVersion: 1,
  version: 1,
  publicEligible: true,
  newIntakeEligible: true,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
  ...overrides,
});

describe("getPartnerServiceActions", () => {
  it("shows the existing restaurant menu route only with its capability", () => {
    expect(getPartnerServiceActions(business({ capabilities: ["RESTAURANT_MENU"] }))).toEqual([
      { key: "restaurantMenu", href: "/partner/businesses/business%2F1/restaurant-menu", icon: "restaurant" },
    ]);
    expect(getPartnerServiceActions(business({ capabilities: ["RESTAURANT_LISTING"] }))).toEqual([]);
  });

  it("maps hotel capabilities to the existing hotel workspace", () => {
    expect(getPartnerServiceActions(business({ kind: "HOTEL", capabilities: ["HOTEL_INVENTORY"] }))).toEqual([
      { key: "hotelServices", href: "/partner/businesses/business%2F1/hotel", icon: "hotel" },
    ]);
    expect(getPartnerServiceActions(business({ kind: "HOTEL", capabilities: [] }))).toEqual([]);
  });

  it("shows guide destinations independently according to granted capabilities", () => {
    expect(getPartnerServiceActions(business({
      kind: "TOUR_GUIDE",
      capabilities: ["GUIDE_INQUIRY"],
    }))).toEqual([
      { key: "guideInquiries", href: "/partner/businesses/business%2F1/guide-inquiries", icon: "inquiries" },
    ]);
    expect(getPartnerServiceActions(business({
      kind: "TOUR_GUIDE",
      capabilities: ["GUIDE_PROMOTION", "GUIDE_INQUIRY"],
    }))).toHaveLength(2);
  });
});
