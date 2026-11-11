"use client";

import * as React from "react";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { subscribePartnerNotificationEvents } from "@/features/notifications/services/partner-notification-events";
import { chatApi } from "@/features/chat/services/chat-api";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import {
  BOOKING_ACTIVITY_CHANGED_EVENT,
  getPartnerBookingsActivitySummary,
  getUserReservationActivitySummary,
  markUserReservationVerticalSeen,
  notifyBookingActivityChanged,
} from "../services/reservations-activity-api";
import type {
  PartnerBookingsSummaryDto,
  ReservationVerticalKey,
  UserReservationActivitySummaryDto,
} from "../types/activity";

export interface UseBookingActivitySummaryOptions {
  includePartner?: boolean;
  includePendingOffers?: boolean;
}

export function useBookingActivitySummary({
  includePartner = false,
  includePendingOffers = true,
}: UseBookingActivitySummaryOptions = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  const [userSummary, setUserSummary] =
    React.useState<UserReservationActivitySummaryDto | null>(null);
  const [partnerSummary, setPartnerSummary] =
    React.useState<PartnerBookingsSummaryDto | null>(null);
  const [pendingOffers, setPendingOffers] = React.useState<ReservationOfferPreview[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchSummary = React.useCallback(async () => {
    if (!isAuthenticated || !userId) {
      setUserSummary(null);
      setPartnerSummary(null);
      setPendingOffers([]);
      return;
    }

    setLoading(true);
    try {
      const [uRes, pRes, oRes] = await Promise.all([
        getUserReservationActivitySummary(),
        includePartner ? getPartnerBookingsActivitySummary() : Promise.resolve(null),
        includePendingOffers
          ? chatApi.myOffers("PENDING").catch(() => [] as ReservationOfferPreview[])
          : Promise.resolve([] as ReservationOfferPreview[]),
      ]);

      setUserSummary(uRes);
      if (includePartner) {
        setPartnerSummary(pRes);
      }
      if (includePendingOffers) {
        const incoming = Array.isArray(oRes)
          ? oRes.filter((o) => o.recipientId === userId)
          : [];
        setPendingOffers(incoming);
      }
    } finally {
      setLoading(false);
    }
  }, [includePartner, includePendingOffers, isAuthenticated, userId]);

  React.useEffect(() => {
    void fetchSummary();

    if (!isAuthenticated || !userId) return;

    const controller = new AbortController();
    subscribePartnerNotificationEvents({
      onChanged: () => {
        void fetchSummary();
      },
      signal: controller.signal,
    });

    const onRefresh = () => {
      void fetchSummary();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchSummary();
      }
    };

    window.addEventListener("focus", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("app:notifications-refresh", onRefresh);
    window.addEventListener(BOOKING_ACTIVITY_CHANGED_EVENT, onRefresh);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchSummary();
      }
    }, 60000);

    return () => {
      controller.abort();
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("app:notifications-refresh", onRefresh);
      window.removeEventListener(BOOKING_ACTIVITY_CHANGED_EVENT, onRefresh);
      window.clearInterval(timer);
    };
  }, [fetchSummary, isAuthenticated, userId]);

  const pendingOfferCounts = React.useMemo(() => {
    const counts: Record<ReservationVerticalKey, number> = {
      hotels: 0,
      restaurants: 0,
      rentals: 0,
    };
    for (const offer of pendingOffers) {
      if (offer.businessType === "RESTAURANT") counts.restaurants += 1;
      else if (offer.businessType === "RENTAL") counts.rentals += 1;
      else counts.hotels += 1;
    }
    return counts;
  }, [pendingOffers]);

  const markVerticalSeen = React.useCallback(
    async (tab: ReservationVerticalKey) => {
      const verticalMap: Record<ReservationVerticalKey, "HOTELS" | "RESTAURANTS" | "RENTALS"> = {
        hotels: "HOTELS",
        restaurants: "RESTAURANTS",
        rentals: "RENTALS",
      };
      const updated = await markUserReservationVerticalSeen(verticalMap[tab]);
      if (updated) {
        setUserSummary(updated);
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
        window.dispatchEvent(new CustomEvent(BOOKING_ACTIVITY_CHANGED_EVENT));
      }
    },
    [],
  );

  const verticalAttentionCounts = React.useMemo<Record<ReservationVerticalKey, number>>(
    () => ({
      hotels: (userSummary?.verticals?.hotels?.attentionCount ?? 0) + pendingOfferCounts.hotels,
      restaurants:
        (userSummary?.verticals?.restaurants?.attentionCount ?? 0) + pendingOfferCounts.restaurants,
      rentals: (userSummary?.verticals?.rentals?.attentionCount ?? 0) + pendingOfferCounts.rentals,
    }),
    [pendingOfferCounts, userSummary],
  );

  const verticalUnreadCounts = React.useMemo<Record<ReservationVerticalKey, number>>(
    () => ({
      hotels: (userSummary?.verticals?.hotels?.unreadCount ?? 0) + pendingOfferCounts.hotels,
      restaurants:
        (userSummary?.verticals?.restaurants?.unreadCount ?? 0) + pendingOfferCounts.restaurants,
      rentals: (userSummary?.verticals?.rentals?.unreadCount ?? 0) + pendingOfferCounts.rentals,
    }),
    [pendingOfferCounts, userSummary],
  );

  const recommendedUserTab = React.useMemo<ReservationVerticalKey>(() => {
    if (userSummary && userSummary.totalAttentionCount > 0) {
      return userSummary.recommendedTab;
    }
    if (pendingOfferCounts.rentals > 0) return "rentals";
    if (pendingOfferCounts.restaurants > 0) return "restaurants";
    if (pendingOfferCounts.hotels > 0) return "hotels";
    return userSummary?.recommendedTab ?? "hotels";
  }, [pendingOfferCounts, userSummary]);

  const userBadgeCount =
    verticalAttentionCounts.hotels +
    verticalAttentionCounts.restaurants +
    verticalAttentionCounts.rentals;

  const partnerPendingCount =
    (partnerSummary?.pendingTotal ?? 0) > 0
      ? (partnerSummary?.pendingTotal ?? 0)
      : (partnerSummary?.unreadNotificationCount ?? 0);

  return {
    userSummary,
    partnerSummary,
    pendingOfferCounts,
    verticalAttentionCounts,
    verticalUnreadCounts,
    recommendedUserTab,
    userBadgeCount,
    partnerPendingCount,
    loading,
    refresh: fetchSummary,
    markVerticalSeen,
    notifyBookingActivityChanged,
  };
}
