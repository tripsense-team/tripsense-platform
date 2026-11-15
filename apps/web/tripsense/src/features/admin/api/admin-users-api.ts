import { apiClient } from "@/services/api-client";
import type {
  AdminTargetUserStatus,
  AdminUserItem,
  AdminUserPageResponse,
  AdminUserRole,
  AdminUserTripCountsResponse,
  FetchAdminUsersParams,
} from "../types/admin-users.types";

function unwrapApiData<T>(response: unknown): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data?: unknown }).data !== undefined
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

export async function fetchAdminUsers(
  params: FetchAdminUsersParams = {},
): Promise<AdminUserPageResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    query.set("search", trimmedSearch);
  }
  if (params.role && params.role !== "ALL") {
    query.set("role", params.role);
  }
  if (params.status && params.status !== "ALL") {
    query.set("status", params.status);
  }

  const res = await apiClient<unknown>(`/api/users/admin/users?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  return unwrapApiData<AdminUserPageResponse>(res);
}

export async function fetchAdminUserTripCounts(
  userIds: string[],
): Promise<Record<string, number> | null> {
  if (userIds.length === 0) {
    return {};
  }
  try {
    const query = new URLSearchParams();
    userIds.slice(0, 100).forEach((id) => query.append("userIds", id));
    const res = await apiClient<unknown>(
      `/api/admin/analytics/user-trip-counts?${query.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );
    const data = unwrapApiData<AdminUserTripCountsResponse>(res);
    return data?.counts ?? {};
  } catch {
    return null;
  }
}

export async function updateAdminUserStatus(
  userId: string,
  status: AdminTargetUserStatus,
): Promise<AdminUserItem> {
  const res = await apiClient<unknown>(
    `/api/users/admin/users/${encodeURIComponent(userId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  return unwrapApiData<AdminUserItem>(res);
}

export async function updateAdminUserRole(
  userId: string,
  role: AdminUserRole,
): Promise<AdminUserItem> {
  const res = await apiClient<unknown>(
    `/api/users/admin/users/${encodeURIComponent(userId)}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role }),
    },
  );
  return unwrapApiData<AdminUserItem>(res);
}

