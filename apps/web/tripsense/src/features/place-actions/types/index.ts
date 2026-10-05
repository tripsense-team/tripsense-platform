import type { Place } from "@/features/places/types";

export interface PlaceCollection {
  id: string;
  name: string;
  placeCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedStatus {
  placeRef: string;
  saved: boolean;
  collectionIds: string[];
}

export interface TripPlaceMembership {
  placeRef: string;
  added: boolean;
  tripIds: string[];
}

export interface TripPlace {
  id: string;
  tripId: string;
  placeRef: string;
  placeNameSnapshot: string;
  placeAddressSnapshot?: string | null;
  latSnapshot?: number | null;
  lngSnapshot?: number | null;
  addedAt: string;
  version: number;
}

export interface TripPlacesPage {
  content: TripPlace[];
  totalElements: number;
  totalPages: number;
  size: number;
  page: number;
}

export interface SavedPlaceItem {
  placeRef: string;
  place: Place | null;
  collectionIds: string[];
  savedAt: string;
}

export interface SavedPlacesPage {
  content: SavedPlaceItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  page: number;
}
