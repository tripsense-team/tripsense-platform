import { apiClient } from "@/services/api-client";
import type {
  PlaceCollection,
  SavedPlacesPage,
  SavedStatus,
  TripPlaceMembership,
  TripPlacesPage,
} from "../types";

interface PlaceEnvelope<T> {
  success: boolean;
  data: T;
}

interface ServiceEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export async function listCollections(): Promise<PlaceCollection[]> {
  return (await apiClient<PlaceEnvelope<PlaceCollection[]>>("/api/places/me/collections")).data;
}

export async function createCollection(name: string): Promise<PlaceCollection> {
  return (
    await apiClient<PlaceEnvelope<PlaceCollection>>("/api/places/me/collections", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
  ).data;
}

export async function renameCollection(id: string, name: string): Promise<PlaceCollection> {
  return (
    await apiClient<PlaceEnvelope<PlaceCollection>>(`/api/places/me/collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    })
  ).data;
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient(`/api/places/me/collections/${id}`, { method: "DELETE" });
}

export async function getSavedStatuses(placeRefs: string[]): Promise<SavedStatus[]> {
  if (placeRefs.length === 0) return [];
  return (
    await apiClient<PlaceEnvelope<{ items: SavedStatus[] }>>("/api/places/me/saved-status:batch", {
      method: "POST",
      body: JSON.stringify({ placeRefs }),
    })
  ).data.items;
}

export async function addPlaceToCollection(collectionId: string, placeRef: string): Promise<void> {
  await apiClient(`/api/places/me/collections/${collectionId}/places/${encodeURIComponent(placeRef)}`, {
    method: "PUT",
  });
}

export async function removePlaceFromCollection(collectionId: string, placeRef: string): Promise<void> {
  await apiClient(`/api/places/me/collections/${collectionId}/places/${encodeURIComponent(placeRef)}`, {
    method: "DELETE",
  });
}

export async function listSavedPlaces(params: {
  collectionId?: string;
  page?: number;
  size?: number;
} = {}): Promise<SavedPlacesPage> {
  const query = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 20),
  });
  if (params.collectionId) query.set("collectionId", params.collectionId);
  return (
    await apiClient<PlaceEnvelope<SavedPlacesPage>>(`/api/places/me/saved?${query.toString()}`)
  ).data;
}

export async function getTripMemberships(placeRefs: string[]): Promise<TripPlaceMembership[]> {
  if (placeRefs.length === 0) return [];
  return (
    await apiClient<ServiceEnvelope<{ items: TripPlaceMembership[] }>>(
      "/api/trips/place-memberships:batch",
      { method: "POST", body: JSON.stringify({ placeRefs }) },
    )
  ).data.items;
}

export async function addPlaceToTrip(tripId: string, placeRef: string): Promise<void> {
  await apiClient(`/api/trips/${tripId}/places/${encodeURIComponent(placeRef)}`, { method: "PUT" });
}

export async function removePlaceFromTrip(tripId: string, placeRef: string): Promise<void> {
  await apiClient(`/api/trips/${tripId}/places/${encodeURIComponent(placeRef)}`, { method: "DELETE" });
}

export async function listTripPlaces(tripId: string): Promise<TripPlacesPage> {
  return (
    await apiClient<ServiceEnvelope<TripPlacesPage>>(
      `/api/trips/${tripId}/places?page=0&size=100`,
    )
  ).data;
}
