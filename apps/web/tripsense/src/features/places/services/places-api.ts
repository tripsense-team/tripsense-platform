import type {
  AutocompleteResponse,
  PlaceDetailsResponse,
  PlaceSearchParams,
  PlacesResponse,
} from "../types";

export class PlaceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "PlaceApiError";
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as (T & ErrorEnvelope) | null;
  if (!response.ok || !body) {
    throw new PlaceApiError(
      body?.error?.message ?? `Place API request failed with status ${response.status}`,
      response.status,
      body?.error?.code
    );
  }
  return body;
}

export async function searchPlaces(params: PlaceSearchParams): Promise<PlacesResponse> {
  const query = params.q.trim();
  if (!query) {
    return { success: true, data: [], meta: { query, total: 0 } };
  }

  const url = new URL("/api/places/search", window.location.origin);
  url.searchParams.set("q", query);
  if (params.lat !== undefined) url.searchParams.set("lat", params.lat.toString());
  if (params.lng !== undefined) url.searchParams.set("lng", params.lng.toString());
  if (params.radius !== undefined) url.searchParams.set("radius", params.radius.toString());
  if (params.limit !== undefined) url.searchParams.set("limit", params.limit.toString());

  const response = await fetch(url, { signal: params.signal });
  return parseResponse<PlacesResponse>(response);
}

export async function getAutocomplete(
  query: string,
  lat?: number,
  lng?: number,
  limit = 5,
  signal?: AbortSignal
): Promise<AutocompleteResponse> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return { success: true, data: [] };
  }

  const url = new URL("/api/places/autocomplete", window.location.origin);
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("limit", limit.toString());
  if (lat !== undefined) url.searchParams.set("lat", lat.toString());
  if (lng !== undefined) url.searchParams.set("lng", lng.toString());

  const response = await fetch(url, { signal });
  return parseResponse<AutocompleteResponse>(response);
}

export async function getPlaceDetails(
  id: string,
  name?: string,
  lat?: number,
  lng?: number,
  signal?: AbortSignal
): Promise<PlaceDetailsResponse> {
  const url = new URL(`/api/places/${encodeURIComponent(id)}`, window.location.origin);
  if (name) url.searchParams.set("name", name);
  if (lat !== undefined) url.searchParams.set("lat", lat.toString());
  if (lng !== undefined) url.searchParams.set("lng", lng.toString());

  const response = await fetch(url, { signal });
  return parseResponse<PlaceDetailsResponse>(response);
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  radius = 5000,
  category?: string,
  limit = 20,
  signal?: AbortSignal
): Promise<PlacesResponse> {
  const url = new URL("/api/places/nearby", window.location.origin);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lng", lng.toString());
  url.searchParams.set("radius", radius.toString());
  url.searchParams.set("limit", limit.toString());
  if (category) url.searchParams.set("category", category);

  const response = await fetch(url, { signal });
  return parseResponse<PlacesResponse>(response);
}
