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

export interface ISocialPostRepository {
  listPosts(params?: ListPostsParams): Promise<SocialPostPageResponse>;
  getPostById(postId: string): Promise<SocialPost>;
  createPost(
    payload: CreateSocialPostRequest,
    idempotencyKey: string,
  ): Promise<SocialPost>;
  updatePostContent(
    postId: string,
    payload: UpdatePostContentRequest,
  ): Promise<SocialPost>;
  getUploadSignature(): Promise<UploadSignatureResponse>;
  deletePost(postId: string): Promise<void>;
  getUserPosts(
    userId: string,
    params?: ListPostsParams,
  ): Promise<SocialPostPageResponse>;

  // Trip sharing
  createTripShare(
    payload: CreateTripShareRequest,
    idempotencyKey: string,
  ): Promise<SocialPost>;
  previewTripShare(tripId: string): Promise<TripSharePreviewResponse>;
  refreshTripSharePublication(
    postId: string,
    payload: RefreshTripSharePublicationRequest,
    idempotencyKey: string,
  ): Promise<TripShareDetailResponse>;
  updatePostVisibility(
    postId: string,
    visibility: "PUBLIC" | "UNLISTED" | "PRIVATE",
  ): Promise<SocialPost>;
  getTripShareDetail(postId: string): Promise<TripShareDetailResponse>;
  submitPostReport(
    postId: string,
    payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse>;
  submitCommentReport(
    postId: string,
    commentId: string,
    payload: SubmitCommunityReportRequest,
  ): Promise<ReportReceiptResponse>;
  listModerationReports(
    status?: "PENDING" | "DISMISSED" | "ACTIONED",
  ): Promise<ModerationReportPage>;
  decideModerationReport(
    reportId: string,
    action: "DISMISS" | "REMOVE_CONTENT",
    note?: string,
  ): Promise<ModerationReport>;

  // Social interactions
  toggleLikePost(
    postId: string,
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse>;
  listComments(postId: string): Promise<PostComment[]>;
  createComment(
    postId: string,
    payload: CreateCommentRequest,
  ): Promise<PostComment>;
  toggleLikeComment(
    postId: string,
    commentId: string,
    currentLiked?: boolean,
  ): Promise<ToggleLikeResponse>;

  // Community Discovery Rail
  getSuggestedCreators(): Promise<import("../types").SuggestedCreator[]>;
  toggleFollowCreator(
    creatorId: string,
    currentFollowing?: boolean,
  ): Promise<{ following: boolean; followerCount: number }>;
  getDestinationWeather(
    cityId?: string,
  ): Promise<import("../types").DestinationWeather>;
  getTrendingDestinations(): Promise<import("../types").TrendingDestination[]>;
}
