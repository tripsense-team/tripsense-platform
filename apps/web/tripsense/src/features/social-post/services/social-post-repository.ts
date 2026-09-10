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
  UploadSignatureResponse,
} from "../types";

export interface ISocialPostRepository {
  listPosts(params?: ListPostsParams): Promise<SocialPostPageResponse>;
  getPostById(postId: string): Promise<SocialPost>;
  createPost(payload: CreateSocialPostRequest, idempotencyKey: string): Promise<SocialPost>;
  updatePostContent(postId: string, payload: UpdatePostContentRequest): Promise<SocialPost>;
  getUploadSignature(): Promise<UploadSignatureResponse>;
  deletePost(postId: string): Promise<void>;
  getUserPosts(userId: string, params?: ListPostsParams): Promise<SocialPostPageResponse>;

  // Trip sharing
  createTripShare(payload: CreateTripShareRequest, idempotencyKey: string): Promise<SocialPost>;
  updatePostVisibility(postId: string, visibility: "PUBLIC" | "UNLISTED" | "PRIVATE"): Promise<SocialPost>;
  getTripShareDetail(postId: string): Promise<TripShareDetailResponse>;

  // Social interactions
  toggleLikePost(postId: string, currentLiked?: boolean): Promise<ToggleLikeResponse>;
  listComments(postId: string): Promise<PostComment[]>;
  createComment(postId: string, payload: CreateCommentRequest): Promise<PostComment>;
  toggleLikeComment(postId: string, commentId: string, currentLiked?: boolean): Promise<ToggleLikeResponse>;
}
