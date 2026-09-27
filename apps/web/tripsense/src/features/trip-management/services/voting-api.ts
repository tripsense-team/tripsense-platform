import { apiClient } from "@/services/api-client";

export interface DestinationOptionResponse {
  id: string;
  tripId: string;
  placeId: string | null;
  name: string;
  createdByUserId: string;
  voteCount: number;
  hasVoted: boolean;
  voterUserIds: string[];
}

export interface ProposeDestinationRequest {
  placeId: string | null;
  name: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getDestinationOptions(tripId: string): Promise<ApiResponse<DestinationOptionResponse[]>> {
  return apiClient(`/api/trips/${tripId}/destinations`);
}

export async function proposeDestination(tripId: string, payload: ProposeDestinationRequest): Promise<ApiResponse<DestinationOptionResponse>> {
  return apiClient(`/api/trips/${tripId}/destinations`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function voteForDestination(tripId: string, destinationId: string): Promise<ApiResponse<DestinationOptionResponse>> {
  return apiClient(`/api/trips/${tripId}/destinations/${destinationId}/votes`, {
    method: "POST",
  });
}

export async function removeVote(tripId: string, destinationId: string): Promise<ApiResponse<DestinationOptionResponse>> {
  return apiClient(`/api/trips/${tripId}/destinations/${destinationId}/votes`, {
    method: "DELETE",
  });
}
