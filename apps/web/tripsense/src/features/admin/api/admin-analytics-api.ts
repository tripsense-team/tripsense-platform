import { apiClient } from "@/services/api-client";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import type {
  AdminAiStats,
  AdminContextStats,
  AdminPeriodDays,
  AdminRecommendationStats,
  AdminSocialStats,
  AdminTripPlatformAnalytics,
  AdminUnifiedAnalyticsBundle,
  AdminUserStats,
} from "../types/admin-analytics.types";

function unwrapApiData<T>(response: unknown): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data?: unknown }).data !== undefined
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

export async function fetchAdminTripAnalytics(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminTripPlatformAnalytics> {
  const res = await apiClient<unknown>(
    `/api/admin/analytics/overview?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminTripPlatformAnalytics>(res);
}

export async function fetchAdminUserStats(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminUserStats> {
  const res = await apiClient<unknown>(
    `/api/users/admin/stats?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminUserStats>(res);
}

export async function fetchAdminSocialStats(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminSocialStats> {
  const res = await apiClient<unknown>(
    `/api/social/admin/stats?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminSocialStats>(res);
}

export async function fetchAdminRecommendationStats(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminRecommendationStats> {
  const res = await apiClient<unknown>(
    `/api/recommendations/admin/stats?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminRecommendationStats>(res);
}

export async function fetchAdminContextStats(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminContextStats> {
  const res = await apiClient<unknown>(
    `/api/context/admin/stats?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminContextStats>(res);
}

export async function fetchAdminAiStats(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminAiStats> {
  const res = await apiClient<unknown>(
    `/api/ai/admin/stats?periodDays=${periodDays}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  return unwrapApiData<AdminAiStats>(res);
}

export async function fetchAdminUnifiedAnalytics(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminUnifiedAnalyticsBundle> {
  const [
    tripResult,
    userResult,
    socialResult,
    recommendationResult,
    contextResult,
    aiResult,
  ] = await Promise.allSettled([
    fetchAdminTripAnalytics(periodDays),
    fetchAdminUserStats(periodDays),
    fetchAdminSocialStats(periodDays),
    fetchAdminRecommendationStats(periodDays),
    fetchAdminContextStats(periodDays),
    fetchAdminAiStats(periodDays),
  ]);

  const partialErrors: string[] = [];

  const tripAnalytics =
    tripResult.status === "fulfilled" ? tripResult.value : null;
  if (tripResult.status === "rejected") {
    partialErrors.push(
      getSafeErrorMessage(tripResult.reason, "Trip & Commerce analytics unavailable"),
    );
  }

  const userStats =
    userResult.status === "fulfilled" ? userResult.value : null;
  if (userResult.status === "rejected") {
    partialErrors.push(
      getSafeErrorMessage(userResult.reason, "User statistics unavailable"),
    );
  }

  const socialStats =
    socialResult.status === "fulfilled" ? socialResult.value : null;
  if (socialResult.status === "rejected") {
    partialErrors.push(
      getSafeErrorMessage(socialResult.reason, "Community & Review statistics unavailable"),
    );
  }

  const recommendationStats =
    recommendationResult.status === "fulfilled" ? recommendationResult.value : null;
  const contextStats =
    contextResult.status === "fulfilled" ? contextResult.value : null;
  const aiStats =
    aiResult.status === "fulfilled" ? aiResult.value : null;

  return {
    tripAnalytics,
    userStats,
    socialStats,
    recommendationStats,
    contextStats,
    aiStats,
    partialErrors,
  };
}

