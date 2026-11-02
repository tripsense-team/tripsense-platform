import type { BusinessDetailDto, PartnerCapability } from "../types";

export interface PartnerServiceAction {
  key: "restaurantMenu" | "hotelServices" | "guidePromotions" | "guideInquiries" | "subscription";
  href: string;
  icon: "restaurant" | "hotel" | "guide" | "inquiries" | "subscription";
}

const hasCapability = (
  capabilities: PartnerCapability[] | undefined,
  capability: PartnerCapability,
) => capabilities?.includes(capability) ?? false;

export function getPartnerServiceActions(
  business: Pick<BusinessDetailDto, "id" | "kind" | "capabilities">,
): PartnerServiceAction[] {
  const base = `/partner/businesses/${encodeURIComponent(business.id)}`;
  const capabilities = business.capabilities;

  const subscriptionAction: PartnerServiceAction = {
    key: "subscription",
    href: `${base}/subscription`,
    icon: "subscription",
  };

  switch (business.kind) {
    case "RESTAURANT":
      return [
        ...(hasCapability(capabilities, "RESTAURANT_MENU")
          ? [{ key: "restaurantMenu" as const, href: `${base}/restaurant-menu`, icon: "restaurant" as const }]
          : []),
        subscriptionAction,
      ];
    case "HOTEL":
      return [
        ...(["HOTEL_LISTING", "HOTEL_INVENTORY", "HOTEL_BOOKING"].some((capability) =>
          hasCapability(capabilities, capability as PartnerCapability),
        )
          ? [{ key: "hotelServices" as const, href: `${base}/hotel`, icon: "hotel" as const }]
          : []),
        subscriptionAction,
      ];
    case "TOUR_GUIDE":
      return [
        ...(hasCapability(capabilities, "GUIDE_PROMOTION")
          ? [{ key: "guidePromotions" as const, href: `${base}/guide-promotions`, icon: "guide" as const }]
          : []),
        ...(hasCapability(capabilities, "GUIDE_INQUIRY")
          ? [{ key: "guideInquiries" as const, href: `${base}/guide-inquiries`, icon: "inquiries" as const }]
          : []),
        subscriptionAction,
      ];
  }
}
