import { apiClient } from "@/services/api-client";
import type {
  AdminPlaceDetail,
  AdminPlaceMutation,
  AdminPlacePage,
  ApiEnvelope,
} from "../types";

const BASE = "/api/places/admin/catalog";

export interface ListAdminPlacesParams {
  q?: string;
  lifecycle?: string;
  source?: string;
  category?: string;
  cursor?: string;
}

export async function listAdminPlaces(params: ListAdminPlacesParams = {}) {
  const query = new URLSearchParams({ size: "24" });
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return apiClient<ApiEnvelope<AdminPlacePage>>(`${BASE}?${query.toString()}`);
}

export async function getAdminPlace(id: string) {
  return apiClient<ApiEnvelope<AdminPlaceDetail>>(`${BASE}/${encodeURIComponent(id)}`);
}

export async function createAdminPlace(payload: AdminPlaceMutation) {
  return apiClient<ApiEnvelope<AdminPlaceDetail>>(BASE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminPlace(id: string, version: number, payload: AdminPlaceMutation) {
  return apiClient<ApiEnvelope<AdminPlaceDetail>>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "If-Match": `"${version}"` },
    body: JSON.stringify(payload),
  });
}

export async function archiveAdminPlace(id: string, version: number) {
  return apiClient<void>(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "If-Match": `"${version}"` },
  });
}

export async function restoreAdminPlace(id: string, version: number) {
  return apiClient<ApiEnvelope<AdminPlaceDetail>>(
    `${BASE}/${encodeURIComponent(id)}/restore`,
    { method: "POST", headers: { "If-Match": `"${version}"` } },
  );
}
