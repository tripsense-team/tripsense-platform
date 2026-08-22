import { apiClient } from "@/services/api-client";
import type {
  ApiResponse,
  CreateItineraryItemRequest,
  CreateTripRequest,
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse,
  PageResponse,
  ReorderItemsRequest,
  TripResponse,
  UpdateItineraryItemRequest,
  UpdateTripRequest,
} from "../types";

interface ListTripsParams {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  return (await request).data;
}

export function listTrips(params: ListTripsParams = {}): Promise<PageResponse<TripResponse>> {
  const searchParams = new URLSearchParams();
  searchParams.set("size", String(params.size ?? 20));

  if (params.page !== undefined) searchParams.set("page", String(params.page));
  if (params.status) searchParams.set("status", params.status);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  return unwrap(apiClient<ApiResponse<PageResponse<TripResponse>>>(`/api/trips?${searchParams.toString()}`));
}

export function createTrip(payload: CreateTripRequest): Promise<TripResponse> {
  return unwrap(apiClient<ApiResponse<TripResponse>>("/api/trips", { method: "POST", body: JSON.stringify(payload) }));
}

export function getTrip(tripId: string): Promise<TripResponse> {
  return unwrap(apiClient<ApiResponse<TripResponse>>(`/api/trips/${tripId}`));
}

export function updateTrip(tripId: string, payload: UpdateTripRequest): Promise<TripResponse> {
  return unwrap(apiClient<ApiResponse<TripResponse>>(`/api/trips/${tripId}`, { method: "PATCH", body: JSON.stringify(payload) }));
}

export async function deleteTrip(tripId: string): Promise<void> {
  await apiClient<ApiResponse<void>>(`/api/trips/${tripId}`, { method: "DELETE" });
}

export function getItinerary(tripId: string): Promise<ItineraryResponse> {
  return unwrap(apiClient<ApiResponse<ItineraryResponse>>(`/api/trips/${tripId}/itinerary`));
}

export function getItineraryDay(tripId: string, dayId: string): Promise<ItineraryDayResponse> {
  return unwrap(apiClient<ApiResponse<ItineraryDayResponse>>(`/api/trips/${tripId}/itinerary/days/${dayId}`));
}

export function createItineraryItem(
  tripId: string,
  dayId: string,
  payload: CreateItineraryItemRequest
): Promise<ItineraryItemResponse> {
  return unwrap(
    apiClient<ApiResponse<ItineraryItemResponse>>(`/api/trips/${tripId}/itinerary/days/${dayId}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

export function updateItineraryItem(
  tripId: string,
  itemId: string,
  payload: UpdateItineraryItemRequest
): Promise<ItineraryItemResponse> {
  return unwrap(
    apiClient<ApiResponse<ItineraryItemResponse>>(`/api/trips/${tripId}/itinerary/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  );
}

export async function deleteItineraryItem(tripId: string, itemId: string): Promise<void> {
  await apiClient<ApiResponse<void>>(`/api/trips/${tripId}/itinerary/items/${itemId}`, { method: "DELETE" });
}

export function reorderItineraryItems(
  tripId: string,
  dayId: string,
  payload: ReorderItemsRequest
): Promise<ItineraryDayResponse> {
  return unwrap(
    apiClient<ApiResponse<ItineraryDayResponse>>(`/api/trips/${tripId}/itinerary/days/${dayId}/items/reorder`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  );
}
