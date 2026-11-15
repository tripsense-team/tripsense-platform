export type ReservationVerticalKey = "hotels" | "restaurants" | "rentals";

export interface UserVerticalActivityDto {
  unreadCount: number;
  pendingCount: number;
  activeCount: number;
  totalCount: number;
  attentionCount: number;
  latestActivityAt?: string | null;
}

export interface UserReservationActivitySummaryDto {
  totalAttentionCount: number;
  unreadNotificationCount: number;
  recommendedTab: ReservationVerticalKey;
  verticals: Record<ReservationVerticalKey, UserVerticalActivityDto>;
}

export interface PartnerBusinessActivityDto {
  businessId: string;
  kind: string;
  pendingCount: number;
  unreadNotificationCount: number;
  latestPendingAt?: string | null;
}

export interface PartnerBookingsSummaryDto {
  pendingTotal: number;
  unreadNotificationCount: number;
  recommendedDashboardTab: "businesses" | "bookings";
  byServiceType: Record<string, number>;
  businesses: PartnerBusinessActivityDto[];
}

