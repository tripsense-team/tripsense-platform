export interface SocialPostAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface SharedTripHighlight {
  title: string;
  placeName?: string;
  dayNumber: number;
}

export interface SharedTripItineraryItem {
  id: string;
  placeId?: string | null;
  title: string;
  type: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  sortOrder?: number | null;
  status?: string | null;
  notes?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  lat?: number | null;
  lng?: number | null;
  dayNumber?: number | null;
}

export interface SharedTripItineraryDay {
  id: string;
  date?: string | null;
  dayNumber: number;
  items: SharedTripItineraryItem[];
}

export interface SharedTripSummary {
  tripId: string;
  name: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  travelerCount?: number;
  dayCount?: number;
  itineraryItemCount?: number;
  highlights?: SharedTripHighlight[];
  itineraryDays?: SharedTripItineraryDay[];
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
  visibility?: "PUBLIC" | "UNLISTED" | "PRIVATE";
}

export interface UpdatePostVisibilityRequest {
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
}

export interface UpdatePostContentRequest {
  content: string;
}

export interface TripShareDetailResponse {
  post: SocialPost;
  canOpenTrip: boolean;
  tripUnavailableReason?: string;
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
  page?: number;
  size?: number;
}
