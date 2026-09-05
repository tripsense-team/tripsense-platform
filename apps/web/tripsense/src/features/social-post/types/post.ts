export interface SocialPostAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface SocialPost {
  id: string;
  author: SocialPostAuthor;
  content: string;
  mediaUrls?: string[];
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
