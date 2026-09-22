export interface SocialPostAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
  isFollowing?: boolean;
}

export interface SharedTripHighlight {
  title: string;
  placeName?: string;
  dayNumber: number;
}

export interface SharedTripSummary {
  name: string;
  destinationName: string;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
  dayCount?: number;
  itineraryItemCount?: number;
  highlights?: SharedTripHighlight[];
  publicationRevision?: number;
  publishedAt?: string;
  refreshedAt?: string;
  detailAvailability?: "PUBLIC_SNAPSHOT" | "SUMMARY_ONLY_REPUBLISH_REQUIRED";
  datePrecision?: "EXACT" | "DAY_NUMBER_ONLY";
}

export interface SocialPost {
  id: string;
  type?: "STANDARD" | "TRIP_SHARE";
  author: SocialPostAuthor;
  content: string;
  mediaUrls?: string[];
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
  trip?: SharedTripSummary | null;
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
}

export interface CreateSocialPostRequest {
  content: string;
  media?: SocialPostMedia[];
}

export interface CreateTripShareRequest {
  tripId: string;
  caption?: string;
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  expectedSnapshotFingerprint: string;
  consentVersion: "PUBLIC_TRIP_V1";
}

export interface UpdatePostVisibilityRequest {
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
}

export interface UpdatePostContentRequest {
  content: string;
}

export interface TripShareDetailResponse {
  post: SocialPost;
  publication?: PublicTripSnapshot | null;
  detailAvailability: "PUBLIC_SNAPSHOT" | "SUMMARY_ONLY_REPUBLISH_REQUIRED";
  canManagePublication: boolean;
  sourceTripId?: string | null;
}

export interface PublicTripSnapshot {
  schemaVersion: 1;
  publicationRevision: number;
  publishedAt?: string | null;
  datePrecision: "EXACT" | "DAY_NUMBER_ONLY";
  timePrecision: "EXACT" | "NONE";
  summary: {
    name: string;
    destinationName: string;
    coverImageUrl?: string | null;
    dayCount: number;
    itineraryItemCount: number;
    highlights: SharedTripHighlight[];
  };
  days: Array<{
    dayNumber: number;
    date?: string | null;
    items: Array<{
      order: number;
      title: string;
      type: string;
      startTime?: string | null;
      endTime?: string | null;
      durationMinutes?: number | null;
      placeName?: string | null;
    }>;
  }>;
}

export interface TripSharePreviewResponse {
  snapshot: PublicTripSnapshot;
  snapshotFingerprint: string;
  consentVersion: "PUBLIC_TRIP_V1";
  warnings: string[];
}

export interface RefreshTripSharePublicationRequest {
  expectedSnapshotFingerprint: string;
  consentVersion: "PUBLIC_TRIP_V1";
}

export type CommunityReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "DANGEROUS_CONTENT"
  | "PRIVACY"
  | "MISINFORMATION"
  | "OTHER";

export interface SubmitCommunityReportRequest {
  reason: CommunityReportReason;
  details?: string;
}

export interface ReportReceiptResponse {
  id: string;
  status: "PENDING";
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  postId: string;
  reporterId: string;
  reason: CommunityReportReason;
  details?: string | null;
  status: "PENDING" | "DISMISSED" | "ACTIONED";
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  moderatorNote?: string | null;
}

export interface ModerationReportPage {
  items: ModerationReport[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
}

export interface SocialPostMedia {
  publicId: string;
  secureUrl: string;
  resourceType: "image";
  format: string;
  width: number;
  height: number;
  sortOrder: number;
}

export interface UploadSignatureResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  resourceType: "image";
  allowedFormats: string[];
}

export interface PostComment {
  id: string;
  postId: string;
  parentId?: string | null;
  author: SocialPostAuthor;
  content: string;
  createdAt: string;
  likeCount: number;
  isLiked?: boolean;
  replyToAuthorName?: string;
  children?: PostComment[];
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string | null;
}

export interface ToggleLikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface SocialPostPageResponse {
  items: SocialPost[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
}

export interface ListPostsParams {
  userId?: string;
  type?: "ALL" | "STANDARD" | "TRIP_SHARE";
  page?: number;
  size?: number;
}
