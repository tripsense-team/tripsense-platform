import { apiClient } from "@/services/api-client";
import type {
  PartnerBookingsSummaryDto,
  UserReservationActivitySummaryDto,
} from "../types/activity";

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const BOOKING_ACTIVITY_CHANGED_EVENT = "reservations:activity-changed";

export function notifyBookingActivityChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_ACTIVITY_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
}

export async function getUserReservationActivitySummary(): Promise<UserReservationActivitySummaryDto | null> {
  try {
    const res = await apiClient<ApiResponseWrapper<UserReservationActivitySummaryDto>>(
      "/api/me/reservations/activity-summary",
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function markUserReservationVerticalSeen(
  vertical: "HOTELS" | "RESTAURANTS" | "RENTALS",
): Promise<UserReservationActivitySummaryDto | null> {
  try {
    const res = await apiClient<ApiResponseWrapper<UserReservationActivitySummaryDto>>(
      "/api/me/reservations/activity-summary/mark-seen",
      {
        method: "POST",
        body: JSON.stringify({ vertical }),
      },
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function getPartnerBookingsActivitySummary(): Promise<PartnerBookingsSummaryDto | null> {
  try {
    const res = await apiClient<ApiResponseWrapper<PartnerBookingsSummaryDto>>(
      "/api/partners/bookings/activity-summary",
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

