import { apiClient } from "@/services/api-client";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import type {
  AdminPeriodDays,
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

export async function fetchAdminUnifiedAnalytics(
  periodDays: AdminPeriodDays = 30,
): Promise<AdminUnifiedAnalyticsBundle> {
  const [tripResult, userResult, socialResult] = await Promise.allSettled([
    fetchAdminTripAnalytics(periodDays),
    fetchAdminUserStats(periodDays),
    fetchAdminSocialStats(periodDays),
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

  return {
    tripAnalytics,
    userStats,
    socialStats,
    partialErrors,
  };
}

