export type AdminReviewStatus = "PUBLISHED" | "REMOVED";

export type AdminReviewFilterStatus = "ALL" | "PUBLISHED" | "REMOVED" | "FLAGGED";

export interface AdminPlaceReviewItem {
  id: string;
  placeRef: string;
  placeName: string;
  authorUserId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  content: string;
  status: AdminReviewStatus;
  pendingReportCount: number;
  totalReportCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlaceReviewSummary {
  total: number;
  published: number;
  removed: number;
  flagged: number;
}

export interface AdminPlaceReviewPageResponse {
  items: AdminPlaceReviewItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary: AdminPlaceReviewSummary;
}

export interface AdminPlaceReviewStatusResponse {
  id: string;
  status: AdminReviewStatus;
  pendingReportCount: number;
  version: number;
  updatedAt: string;
}

export interface FetchAdminReviewsParams {
  page?: number;
  size?: number;
  search?: string;
  status?: AdminReviewFilterStatus;
  rating?: number | null;
}

