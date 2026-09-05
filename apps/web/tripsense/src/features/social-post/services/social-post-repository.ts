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

export interface ISocialPostRepository {
  listPosts(params?: ListPostsParams): Promise<SocialPostPageResponse>;
  getPostById(postId: string): Promise<SocialPost>;
  createPost(payload: CreateSocialPostRequest, idempotencyKey: string): Promise<SocialPost>;
  getUploadSignature(): Promise<UploadSignatureResponse>;
  deletePost(postId: string): Promise<void>;
  getUserPosts(userId: string, params?: ListPostsParams): Promise<SocialPostPageResponse>;

  // Social interactions
  toggleLikePost(postId: string, currentLiked?: boolean): Promise<ToggleLikeResponse>;
  listComments(postId: string): Promise<PostComment[]>;
  createComment(postId: string, payload: CreateCommentRequest): Promise<PostComment>;
  toggleLikeComment(postId: string, commentId: string, currentLiked?: boolean): Promise<ToggleLikeResponse>;
}
