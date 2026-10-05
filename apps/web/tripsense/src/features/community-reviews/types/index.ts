export interface CommunityReviewAuthor {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CommunityReview {
  id: string;
  author: CommunityReviewAuthor;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  ownedByCurrentUser: boolean;
}

export interface CommunityReviewsPage {
  placeRef: string;
  summary: { averageRating: number; reviewCount: number };
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  items: CommunityReview[];
  currentUserReview: CommunityReview | null;
}

export interface CommunityReviewInput {
  rating: number;
  content: string;
  version?: number;
}
