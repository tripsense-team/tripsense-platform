import { apiClient } from "@/services/api-client";
import type {
  CommunityReview,
  CommunityReviewInput,
  CommunityReviewsPage,
} from "../types";

interface Envelope<T> {
  success: boolean;
  data: T;
}

export async function getCommunityReviews(
  placeRef: string,
  page = 0,
  size = 10,
): Promise<CommunityReviewsPage> {
  return (
    await apiClient<Envelope<CommunityReviewsPage>>(
      `/api/social/places/${encodeURIComponent(placeRef)}/reviews?page=${page}&size=${size}`,
    )
  ).data;
}

export async function createCommunityReview(
  placeRef: string,
  input: CommunityReviewInput,
): Promise<CommunityReview> {
  return (
    await apiClient<Envelope<CommunityReview>>(
      `/api/social/places/${encodeURIComponent(placeRef)}/reviews`,
      { method: "POST", body: JSON.stringify(input) },
    )
  ).data;
}

export async function updateCommunityReview(
  reviewId: string,
  input: CommunityReviewInput,
): Promise<CommunityReview> {
  return (
    await apiClient<Envelope<CommunityReview>>(`/api/social/place-reviews/${reviewId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })
  ).data;
}

export async function deleteCommunityReview(reviewId: string): Promise<void> {
  await apiClient(`/api/social/place-reviews/${reviewId}`, { method: "DELETE" });
}
