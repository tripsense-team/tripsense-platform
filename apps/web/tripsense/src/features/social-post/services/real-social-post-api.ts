import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/features/auth";
import type {
  CreateCommentRequest,
  CreateSocialPostRequest,
  ListPostsParams,
  PostComment,
  SocialPost,
  SocialPostPageResponse,
  ToggleLikeResponse,
  UploadSignatureResponse,
} from "../types";
import type { ISocialPostRepository } from "./social-post-repository";

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  return response.data;
}

export class RealSocialPostApi implements ISocialPostRepository {
  async listPosts(params: ListPostsParams = {}): Promise<SocialPostPageResponse> {
    const searchParams = new URLSearchParams();
    if (params.page !== undefined) searchParams.set("page", String(params.page));
    if (params.size !== undefined) searchParams.set("size", String(params.size));
    if (params.userId) searchParams.set("userId", params.userId);

    const query = searchParams.toString();
    const endpoint = `/api/social/posts${query ? `?${query}` : ""}`;

    return unwrap(apiClient<ApiResponse<SocialPostPageResponse>>(endpoint));
  }

  async getPostById(postId: string): Promise<SocialPost> {
    return unwrap(apiClient<ApiResponse<SocialPost>>(`/api/social/posts/${postId}`));
  }

  async createPost(payload: CreateSocialPostRequest, idempotencyKey: string): Promise<SocialPost> {
    return unwrap(
      apiClient<ApiResponse<SocialPost>>("/api/social/posts", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      })
    );
  }

  async getUploadSignature(): Promise<UploadSignatureResponse> {
    return unwrap(
      apiClient<ApiResponse<UploadSignatureResponse>>("/api/social/media/upload-signature", {
        method: "POST",
        body: JSON.stringify({ resourceType: "image" }),
      })
    );
  }

  async deletePost(postId: string): Promise<void> {
    await apiClient<ApiResponse<void>>(`/api/social/posts/${postId}`, {
      method: "DELETE",
    });
  }

  async getUserPosts(userId: string, params: ListPostsParams = {}): Promise<SocialPostPageResponse> {
    return this.listPosts({ ...params, userId });
  }

  async toggleLikePost(postId: string, currentLiked?: boolean): Promise<ToggleLikeResponse> {
    const method = currentLiked ? "DELETE" : "POST";
    return unwrap(
      apiClient<ApiResponse<ToggleLikeResponse>>(`/api/social/posts/${postId}/likes`, {
        method,
      })
    );
  }

  async listComments(postId: string): Promise<PostComment[]> {
    return unwrap(
      apiClient<ApiResponse<PostComment[]>>(`/api/social/posts/${postId}/comments`)
    );
  }

  async createComment(postId: string, payload: CreateCommentRequest): Promise<PostComment> {
    return unwrap(
      apiClient<ApiResponse<PostComment>>(`/api/social/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  }

  async toggleLikeComment(
    postId: string,
    commentId: string,
    currentLiked?: boolean
  ): Promise<ToggleLikeResponse> {
    const method = currentLiked ? "DELETE" : "POST";
    return unwrap(
      apiClient<ApiResponse<ToggleLikeResponse>>(
        `/api/social/posts/${postId}/comments/${commentId}/likes`,
        { method }
      )
    );
  }
}
