import { apiClient } from "@/services/api-client";
import type {
  AdminTripArchiveResponse,
  AdminTripPageResponse,
  FetchAdminTripsParams,
  PublicProfileSummary,
} from "../types/admin-trips.types";

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

export async function fetchAdminTrips(
  params: FetchAdminTripsParams = {},
): Promise<AdminTripPageResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 20));

  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    query.set("search", trimmedSearch);
  }
  if (params.visibility && params.visibility !== "ALL") {
    query.set("visibility", params.visibility);
  }
  if (params.archived && params.archived !== "ALL") {
    query.set("archived", params.archived);
  }

  const res = await apiClient<unknown>(`/api/admin/trips?${query.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  return unwrapApiData<AdminTripPageResponse>(res);
}

export async function updateAdminTripArchive(
  tripId: string,
  archived: boolean,
  version?: number,
): Promise<AdminTripArchiveResponse> {
  const res = await apiClient<unknown>(
    `/api/admin/trips/${encodeURIComponent(tripId)}/archive`,
    {
      method: "PATCH",
      body: JSON.stringify({ archived, version }),
    },
  );
  return unwrapApiData<AdminTripArchiveResponse>(res);
}

export async function fetchTripCreatorProfiles(
  userIds: string[],
): Promise<Record<string, PublicProfileSummary> | null> {
  if (userIds.length === 0) {
    return {};
  }
  const uniqueIds = Array.from(new Set(userIds)).slice(0, 100);
  try {
    const res = await apiClient<unknown>("/api/users/public-profiles:batch", {
      method: "POST",
      body: JSON.stringify({ userIds: uniqueIds }),
      cache: "no-store",
    });
    const list = unwrapApiData<PublicProfileSummary[]>(res);
    if (!Array.isArray(list)) {
      return {};
    }
    return list.reduce<Record<string, PublicProfileSummary>>((acc, item) => {
      if (item && item.userId) {
        acc[item.userId] = item;
      }
      return acc;
    }, {});
  } catch {
    return null;
  }
}

