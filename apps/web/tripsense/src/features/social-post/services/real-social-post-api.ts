import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/features/auth";
import type {
  CreateCommentRequest,
  CreateSocialPostRequest,
  CreateTripShareRequest,
  ListPostsParams,
  PostComment,
  SocialPost,
  SocialPostPageResponse,
  ToggleLikeResponse,
  UpdatePostContentRequest,
  TripShareDetailResponse,
  TripSharePreviewResponse,
  RefreshTripSharePublicationRequest,
  SubmitCommunityReportRequest,
  ReportReceiptResponse,
  ModerationReport,
  ModerationReportPage,
  UploadSignatureResponse,
} from "../types";
import type { ISocialPostRepository } from "./social-post-repository";

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  return response.data;
}

export class RealSocialPostApi implements ISocialPostRepository {
  async listPosts(
    params: ListPostsParams = {},
  ): Promise<SocialPostPageResponse> {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined)
      searchParams.set("page", String(params.page));
    if (params.size !== undefined)
      searchParams.set("size", String(params.size));
    if (params.userId) searchParams.set("userId", params.userId);
    if (params.type) searchParams.set("type", params.type);

    const query = searchParams.toString();
    const endpoint = `/api/social/posts${query ? `?${query}` : ""}`;

    return unwrap(apiClient<ApiResponse<SocialPostPageResponse>>(endpoint));
  }

  async getPostById(postId: string): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>(`/api/social/posts/${postId}`),
    );
  }

  async createPost(
    payload: CreateSocialPostRequest,
    idempotencyKey: string,
  ): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>("/api/social/posts", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      }),
    );
  }

  async updatePostContent(
    postId: string,
    payload: UpdatePostContentRequest,
  ): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>(`/api/social/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    );
  }

  async createTripShare(
    payload: CreateTripShareRequest,
    idempotencyKey: string,
  ): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>("/api/social/trip-shares", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      }),
    );
  }

  async previewTripShare(tripId: string): Promise<TripSharePreviewResponse> {
    return unwrap(
      apiClient<ApiResponse<TripSharePreviewResponse>>(
        "/api/social/trip-shares/preview",
        {
          method: "POST",
          body: JSON.stringify({ tripId }),
        },
      ),
    );
  }

  async refreshTripSharePublication(
    postId: string,
    payload: RefreshTripSharePublicationRequest,
    idempotencyKey: string,
  ): Promise<TripShareDetailResponse> {
    return unwrap(
      apiClient<ApiResponse<TripShareDetailResponse>>(
        `/api/social/trip-shares/${postId}/publication`,
        {
          method: "PUT",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(payload),
        },
      ),
    );
  }

  async updatePostVisibility(
    postId: string,
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE",
  ): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>(
        `/api/social/posts/${postId}/visibility`,
        {
          method: "PATCH",
          body: JSON.stringify({ visibility }),
        },
      ),
    );
  }

  async getTripShareDetail(postId: string): Promise<TripShareDetailResponse> {
    return unwrap(
      apiClient<ApiResponse<TripShareDetailResponse>>(
        `/api/social/trip-shares/${postId}`,
      ),
    );
  }

  async submitPostReport(
    postId: string,
    payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse> {
    return unwrap(
      apiClient<ApiResponse<ReportReceiptResponse>>(
        `/api/social/posts/${postId}/reports`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    );
  }

  async submitCommentReport(
    postId: string,
    commentId: string,
    payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse> {
    return unwrap(
      apiClient<ApiResponse<ReportReceiptResponse>>(
        `/api/social/posts/${postId}/comments/${commentId}/reports`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    );
  }

  async listModerationReports(
    status: "PENDING" | "DISMISSED" | "ACTIONED" = "PENDING",
  ): Promise<ModerationReportPage> {
    return unwrap(
      apiClient<ApiResponse<ModerationReportPage>>(
        `/api/social/moderation/reports?status=${status}&page=0&size=50`,
      ),
    );
  }

  async decideModerationReport(
    reportId: string,
    action: "DISMISS" | "REMOVE_CONTENT",
    note?: string,
  ): Promise<ModerationReport> {
    return unwrap(
      apiClient<ApiResponse<ModerationReport>>(
        `/api/social/moderation/reports/${reportId}/decision`,
        { method: "POST", body: JSON.stringify({ action, note }) },
      ),
    );
  }

  async getUploadSignature(): Promise<UploadSignatureResponse> {
    return unwrap(
      apiClient<ApiResponse<UploadSignatureResponse>>(
        "/api/social/media/upload-signature",
        {
          method: "POST",
          body: JSON.stringify({ resourceType: "image" }),
        },
      ),
    );
  }

  async deletePost(postId: string): Promise<void> {
    await apiClient<ApiResponse<void>>(`/api/social/posts/${postId}`, {
      method: "DELETE",
    });
  }

  async getUserPosts(
    userId: string,
    params: ListPostsParams = {},
  ): Promise<SocialPostPageResponse> {
    return this.listPosts({ ...params, userId });
  }

  async toggleLikePost(
    postId: string,
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse> {
    const method = currentLiked ? "DELETE" : "POST";
    return unwrap(
      apiClient<ApiResponse<ToggleLikeResponse>>(
        `/api/social/posts/${postId}/likes`,
        {
          method,
        },
      ),
    );
  }

  async listComments(postId: string): Promise<PostComment[]> {
    return unwrap(
      apiClient<ApiResponse<PostComment[]>>(
        `/api/social/posts/${postId}/comments`,
      ),
    );
  }

  async createComment(
    postId: string,
    payload: CreateCommentRequest,
  ): Promise<PostComment> {
    return unwrap(
      apiClient<ApiResponse<PostComment>>(
        `/api/social/posts/${postId}/comments`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    );
  }

  async toggleLikeComment(
    postId: string,
    commentId: string,
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse> {
    const method = currentLiked ? "DELETE" : "POST";
    return unwrap(
      apiClient<ApiResponse<ToggleLikeResponse>>(
        `/api/social/posts/${postId}/comments/${commentId}/likes`,
        { method },
      ),
    );
  }

  async getSuggestedCreators(): Promise<import("../types").SuggestedCreator[]> {
    try {
      return await unwrap(
        apiClient<ApiResponse<import("../types").SuggestedCreator[]>>(
          "/api/social/creators/suggested",
        ),
      );
    } catch {
      // Graceful fallback to default featured creators when backend endpoint is not yet connected
      const mockRepo = await import("./mock-social-post-repository").then(
        (m) => new m.MockSocialPostRepository(),
      );
      return mockRepo.getSuggestedCreators();
    }
  }

  async toggleFollowCreator(
    creatorId: string,
    currentFollowing?: boolean,
  ): Promise<{ following: boolean; followerCount: number }> {
    const nextState = !currentFollowing;
    try {
      return await unwrap(
        apiClient<ApiResponse<{ following: boolean; followerCount: number }>>(
          `/api/social/users/${creatorId}/follow`,
          {
            method: nextState ? "POST" : "DELETE",
          },
        ),
      );
    } catch {
      const mockRepo = await import("./mock-social-post-repository").then(
        (m) => new m.MockSocialPostRepository(),
      );
      return mockRepo.toggleFollowCreator(creatorId, currentFollowing);
    }
  }

  async getDestinationWeather(
    cityId = "dalat",
  ): Promise<import("../types").DestinationWeather> {
    try {
      return await unwrap(
        apiClient<ApiResponse<import("../types").DestinationWeather>>(
          `/api/social/weather?cityId=${cityId}`,
        ),
      );
    } catch {
      const mockRepo = await import("./mock-social-post-repository").then(
        (m) => new m.MockSocialPostRepository(),
      );
      return mockRepo.getDestinationWeather(cityId);
    }
  }

  async getTrendingDestinations(): Promise<
    import("../types").TrendingDestination[]
  > {
    try {
      return await unwrap(
        apiClient<ApiResponse<import("../types").TrendingDestination[]>>(
          "/api/social/destinations/trending",
        ),
      );
    } catch {
      const mockRepo = await import("./mock-social-post-repository").then(
        (m) => new m.MockSocialPostRepository(),
      );
      return mockRepo.getTrendingDestinations();
    }
  }
}
