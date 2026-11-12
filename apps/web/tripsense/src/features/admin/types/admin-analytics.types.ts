export type AdminPeriodDays = 7 | 30 | 90 | 365;

export interface AdminAnalyticsPeriod {
  days: number;
  from: string;
  to: string;
}

export interface AdminDestinationRankItem {
  destinationName: string;
  tripsCount: number;
  sharePercent: number;
  growthPercent: number;
}

export interface AdminVisibilityBreakdown {
  publicCount: number;
  sharedCount: number;
  privateCount: number;
}

export interface AdminTripStats {
  totalTrips: number;
  periodTrips: number;
  previousPeriodTrips: number;
  tripsGrowthPercent: number;
  totalAiCommits: number;
  periodAiCommits: number;
  previousPeriodAiCommits: number;
  aiCommitsGrowthPercent: number;
  aiAssistedTripsCount: number;
  manualTripsCount: number;
  aiAdoptionRatePercent: number;
  distinctDestinationsCount: number;
  avgCollaboratorsPerTrip: number;
  visibilityBreakdown: AdminVisibilityBreakdown;
  topDestinations: AdminDestinationRankItem[];
}

export interface AdminPartnerByKind {
  hotelCount: number;
  restaurantCount: number;
  tourGuideCount: number;
  rentalCount: number;
}

export interface AdminApplicationFunnel {
  submittedCount: number;
  approvedCount: number;
  changesRequiredCount: number;
  rejectedCount: number;
}

export interface AdminHotelBookingFunnel {
  total: number;
  confirmed: number;
  checkedIn: number;
  checkedOut: number;
  cancelled: number;
  held: number;
}

export interface AdminRestaurantReservationFunnel {
  total: number;
  requested: number;
  confirmed: number;
  cancelled: number;
  rejected: number;
}

export interface AdminRentalBookingFunnel {
  total: number;
  pending: number;
  confirmed: number;
  inUse: number;
  returned: number;
  cancelled: number;
}

export interface AdminGuideInquiryFunnel {
  total: number;
  active: number;
  contactAgreed: number;
  closedOrDeclined: number;
}

export interface AdminVoucherStats {
  totalActiveVouchers: number;
  redemptionsCount: number;
  totalDiscountAmount: number;
}

export interface AdminPartnerAndBookingStats {
  totalPartnerBusinesses: number;
  publishedPartnerBusinesses: number;
  partnerByKind: AdminPartnerByKind;
  applicationFunnel: AdminApplicationFunnel;
  hotelBookingFunnel: AdminHotelBookingFunnel;
  restaurantReservationFunnel: AdminRestaurantReservationFunnel;
  rentalBookingFunnel: AdminRentalBookingFunnel;
  guideInquiryFunnel: AdminGuideInquiryFunnel;
  voucherStats: AdminVoucherStats;
}

export interface AdminFinanceAndSubscriptionStats {
  totalHotelGmv: number;
  periodHotelGmv: number;
  escrowHoldingAmount: number;
  completedHotelGmv: number;
  hotelCommissionRevenue: number;
  subscriptionRevenue: number;
  periodSubscriptionRevenue: number;
  paidSubscriptionOrdersCount: number;
  totalPlatformRevenue: number;
  partnerPayableBalance: number;
  activeSubscriptionsCount: number;
  trialSubscriptionsCount: number;
  expiredSubscriptionsCount: number;
  pendingWithdrawalsCount: number;
  pendingRefundsCount: number;
}

export interface AdminDailyAnalyticsPoint {
  date: string;
  tripsCreated: number;
  aiCommits: number;
  bookingsCreated: number;
  gmvAmount: number;
  platformRevenueAmount: number;
}

export interface AdminPlatformActivityItem {
  id: string;
  category: string;
  actorLabel: string;
  description: string;
  status: string;
  occurredAt: string;
}

export interface AdminTripPlatformAnalytics {
  period: AdminAnalyticsPeriod;
  tripStats: AdminTripStats;
  partnerAndBookingStats: AdminPartnerAndBookingStats;
  financeAndSubscriptionStats: AdminFinanceAndSubscriptionStats;
  dailySeries: AdminDailyAnalyticsPoint[];
  recentEvents: AdminPlatformActivityItem[];
}

export interface AdminUserRoleBreakdown {
  travelersCount: number;
  partnersCount: number;
  adminsCount: number;
}

export interface AdminAuthProviderBreakdown {
  localCount: number;
  googleCount: number;
}

export interface AdminDailyUserPoint {
  date: string;
  newUsers: number;
}

export interface AdminUserStats {
  period: AdminAnalyticsPeriod;
  totalUsers: number;
  activeUsers: number;
  unverifiedUsers: number;
  inactiveUsers: number;
  periodNewUsers: number;
  previousPeriodNewUsers: number;
  userGrowthPercent: number;
  roleBreakdown: AdminUserRoleBreakdown;
  authProviderBreakdown: AdminAuthProviderBreakdown;
  dailyRegistrations: AdminDailyUserPoint[];
}

export interface AdminPlaceReviewStats {
  totalPublishedReviews: number;
  periodReviews: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
}

export interface AdminModerationStats {
  totalReports: number;
  pendingReportsCount: number;
  actionedReportsCount: number;
  dismissedReportsCount: number;
  postReportsCount: number;
  commentReportsCount: number;
  reviewReportsCount: number;
  chatReportsCount: number;
}

export interface AdminSocialStats {
  period: AdminAnalyticsPeriod;
  totalPosts: number;
  periodPosts: number;
  postsGrowthPercent: number;
  totalComments: number;
  totalReactions: number;
  totalSharedTrips: number;
  placeReviewStats: AdminPlaceReviewStats;
  moderationStats: AdminModerationStats;
}

export interface AdminUnifiedAnalyticsBundle {
  tripAnalytics: AdminTripPlatformAnalytics | null;
  userStats: AdminUserStats | null;
  socialStats: AdminSocialStats | null;
  partialErrors: string[];
}

