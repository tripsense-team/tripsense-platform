export type AdminUserRole = "ADMIN" | "PARTNER" | "USER";
export type AdminUserStatus = "ACTIVE" | "INACTIVE" | "UNVERIFIED";
export type AdminTargetUserStatus = "ACTIVE" | "INACTIVE";

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  authProvider: string;
  partnerEnrolled: boolean;
  onboardingRequired: boolean;
  location: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminUserSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  unverifiedUsers: number;
}

export interface AdminUserPageResponse {
  items: AdminUserItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary: AdminUserSummary;
}

export interface FetchAdminUsersParams {
  page?: number;
  size?: number;
  search?: string;
  role?: "ALL" | AdminUserRole;
  status?: "ALL" | AdminUserStatus;
}

export interface AdminUserTripCountsResponse {
  counts: Record<string, number>;
}

