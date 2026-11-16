export type AdminTripVisibility = "PUBLIC" | "SHARED" | "PRIVATE";

export type AdminTripVisibilityFilter = "ALL" | AdminTripVisibility;

export type AdminTripArchiveFilter = "ALL" | "ACTIVE" | "ARCHIVED";

export interface AdminTripItem {
  id: string;
  ownerUserId: string;
  name: string;
  destinationName: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  status: string;
  visibility: string;
  travelerCount: number | null;
  spotsCount: number;
  isAiGenerated: boolean;
  archived: boolean;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTripSummary {
  totalTrips: number;
  activeTrips: number;
  archivedTrips: number;
  aiCraftedTrips: number;
  publicTrips: number;
}

export interface AdminTripPageResponse {
  items: AdminTripItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary: AdminTripSummary;
}

export interface AdminTripArchiveResponse {
  id: string;
  status: string;
  archived: boolean;
  archivedAt: string | null;
  version: number;
  updatedAt: string;
}

export interface PublicProfileSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FetchAdminTripsParams {
  page?: number;
  size?: number;
  search?: string;
  visibility?: AdminTripVisibilityFilter;
  archived?: AdminTripArchiveFilter;
}

