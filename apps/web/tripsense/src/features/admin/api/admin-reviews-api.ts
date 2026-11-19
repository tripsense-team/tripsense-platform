import { apiClient } from "@/services/api-client";
import type {
  AdminPlaceReviewPageResponse,
  AdminPlaceReviewStatusResponse,
  AdminReviewStatus,
  FetchAdminReviewsParams,
} from "../types/admin-reviews.types";

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

export async function fetchAdminReviews(
  params: FetchAdminReviewsParams = {},
): Promise<AdminPlaceReviewPageResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    query.set("search", trimmedSearch);
  }
  if (params.status && params.status !== "ALL") {
    query.set("status", params.status);
  }
  if (typeof params.rating === "number" && params.rating >= 1 && params.rating <= 5) {
    query.set("rating", String(params.rating));
  }

  const res = await apiClient<unknown>(`/api/social/admin/reviews?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  return unwrapApiData<AdminPlaceReviewPageResponse>(res);
}

export async function updateAdminReviewStatus(
  reviewId: string,
  status: AdminReviewStatus,
  options?: { reason?: string; version?: number },
): Promise<AdminPlaceReviewStatusResponse> {
  const res = await apiClient<unknown>(
    `/api/social/admin/reviews/${encodeURIComponent(reviewId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        reason: options?.reason,
        version: options?.version,
      }),
    },
  );
  return unwrapApiData<AdminPlaceReviewStatusResponse>(res);
}

