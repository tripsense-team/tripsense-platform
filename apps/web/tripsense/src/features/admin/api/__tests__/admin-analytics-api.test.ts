import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchAdminUnifiedAnalytics } from "../admin-analytics-api";
import * as apiClientModule from "@/services/api-client";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

describe("fetchAdminUnifiedAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps ApiResponse data across trip, user, and social endpoints", async () => {
    const mockedApiClient = vi.mocked(apiClientModule.apiClient);
    mockedApiClient.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/api/admin/analytics/overview")) {
        return {
          data: {
            period: { days: 30, from: "2026-10-14", to: "2026-11-12" },
            tripStats: {
              totalTrips: 120,
              periodTrips: 40,
              previousPeriodTrips: 20,
              tripsGrowthPercent: 100,
              totalAiCommits: 85,
              periodAiCommits: 30,
              previousPeriodAiCommits: 15,
              aiCommitsGrowthPercent: 100,
              aiAssistedTripsCount: 78,
              manualTripsCount: 42,
              aiAdoptionRatePercent: 65,
              distinctDestinationsCount: 18,
              avgCollaboratorsPerTrip: 1.8,
              visibilityBreakdown: { publicCount: 30, sharedCount: 40, privateCount: 50 },
              topDestinations: [],
            },
            partnerAndBookingStats: {
              totalPartnerBusinesses: 12,
              publishedPartnerBusinesses: 9,
              partnerByKind: {
                hotelCount: 4,
                restaurantCount: 4,
                tourGuideCount: 2,
                rentalCount: 2,
              },
              applicationFunnel: {
                submittedCount: 2,
                approvedCount: 9,
                changesRequiredCount: 1,
                rejectedCount: 0,
              },
              hotelBookingFunnel: {
                total: 25,
                confirmed: 10,
                checkedIn: 2,
                checkedOut: 10,
                cancelled: 2,
                held: 1,
              },
              restaurantReservationFunnel: {
                total: 18,
                requested: 3,
                confirmed: 12,
                cancelled: 2,
                rejected: 1,
              },
              rentalBookingFunnel: {
                total: 8,
                pending: 1,
                confirmed: 2,
                inUse: 1,
                returned: 3,
                cancelled: 1,
              },
              guideInquiryFunnel: {
                total: 6,
                active: 2,
                contactAgreed: 3,
                closedOrDeclined: 1,
              },
              voucherStats: {
                totalActiveVouchers: 3,
                redemptionsCount: 7,
                totalDiscountAmount: 450000,
              },
            },
            financeAndSubscriptionStats: {
              totalHotelGmv: 25000000,
              periodHotelGmv: 10000000,
              escrowHoldingAmount: 5000000,
              completedHotelGmv: 20000000,
              hotelCommissionRevenue: 2000000,
              subscriptionRevenue: 1500000,
              periodSubscriptionRevenue: 500000,
              paidSubscriptionOrdersCount: 5,
              totalPlatformRevenue: 3500000,
              partnerPayableBalance: 18000000,
              activeSubscriptionsCount: 5,
              trialSubscriptionsCount: 4,
              expiredSubscriptionsCount: 1,
              pendingWithdrawalsCount: 1,
              pendingRefundsCount: 0,
            },
            dailySeries: [],
            recentEvents: [],
          },
        };
      }
      if (endpoint.includes("/api/users/admin/stats")) {
        return {
          data: {
            period: { days: 30, from: "2026-10-14", to: "2026-11-12" },
            totalUsers: 340,
            activeUsers: 310,
            unverifiedUsers: 20,
            inactiveUsers: 10,
            periodNewUsers: 45,
            previousPeriodNewUsers: 30,
            userGrowthPercent: 50,
            roleBreakdown: { travelersCount: 320, partnersCount: 18, adminsCount: 2 },
            authProviderBreakdown: { localCount: 200, googleCount: 140 },
            dailyRegistrations: [],
          },
        };
      }
      return {
        data: {
          period: { days: 30, from: "2026-10-14", to: "2026-11-12" },
          totalPosts: 80,
          periodPosts: 20,
          postsGrowthPercent: 25,
          totalComments: 150,
          totalReactions: 420,
          totalSharedTrips: 35,
          placeReviewStats: {
            totalPublishedReviews: 60,
            periodReviews: 15,
            averageRating: 4.7,
            fiveStarCount: 45,
            fourStarCount: 10,
            threeStarCount: 3,
            twoStarCount: 1,
            oneStarCount: 1,
          },
          moderationStats: {
            totalReports: 5,
            pendingReportsCount: 1,
            actionedReportsCount: 2,
            dismissedReportsCount: 2,
            postReportsCount: 2,
            commentReportsCount: 1,
            reviewReportsCount: 1,
            chatReportsCount: 1,
          },
        },
      };
    });

    const bundle = await fetchAdminUnifiedAnalytics(30);

    expect(bundle.partialErrors).toHaveLength(0);
    expect(bundle.tripAnalytics?.tripStats.totalTrips).toBe(120);
    expect(bundle.tripAnalytics?.financeAndSubscriptionStats.totalPlatformRevenue).toBe(3500000);
    expect(bundle.userStats?.totalUsers).toBe(340);
    expect(bundle.socialStats?.placeReviewStats.averageRating).toBe(4.7);
  });

  it("handles partial service failure gracefully without losing fulfilled service data", async () => {
    const mockedApiClient = vi.mocked(apiClientModule.apiClient);
    mockedApiClient.mockImplementation(async (endpoint: string) => {
      if (endpoint.includes("/api/social/admin/stats")) {
        throw new Error("Connection refused");
      }
      return { data: { period: { days: 7, from: "2026-11-06", to: "2026-11-12" } } };
    });

    const bundle = await fetchAdminUnifiedAnalytics(7);

    expect(bundle.tripAnalytics).not.toBeNull();
    expect(bundle.userStats).not.toBeNull();
    expect(bundle.socialStats).toBeNull();
    expect(bundle.partialErrors).toHaveLength(1);
  });
});

