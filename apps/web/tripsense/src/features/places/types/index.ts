export interface Location {
  lat: number;
  lng: number;
}

export interface PlaceReview {
  authorName: string;
  profilePhotoUrl?: string;
  rating?: number;
  text?: string;
  relativeTimeDescription?: string;
  time?: number;
}

export interface Place {
  id: string;
  provider?: string;
  providerPlaceId?: string;
  name: string;
  location?: Location;
  address?: string;
  oldAddress?: string;
  city?: string;
  district?: string;
  categories: string[];
  rating?: number;
  userRatingCount?: number;
  photos: string[];
  phone?: string;
  website?: string;
  socials?: string[];
  openingHours?: string;
  businessStatus?: string;
  description?: string;
  reviews?: PlaceReview[];
}

export interface AutocompleteSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
}

export interface PlaceSearchParams {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;
  limit?: number;
  signal?: AbortSignal;
}

export interface PlacesResponse {
  success: boolean;
  data: Place[];
  meta?: {
    query?: string;
    total?: number;
    source?: string;
    city?: string;
  };
}

export interface AutocompleteResponse {
  success: boolean;
  data: AutocompleteSuggestion[];
  meta?: {
    query?: string;
    total?: number;
  };
}

export interface PlaceDetailsResponse {
  success: boolean;
  data: Place;
}
