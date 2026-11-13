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

export interface PlacePhotoEvidence {
  url: string;
  source: string;
  attribution: Array<{ displayName: string; uri?: string | null }>;
  fetchedAt: string;
  displayApproved: boolean;
}

export interface PlaceMediaAsset {
  assetId: string;
  url: string;
  width?: number;
  height?: number;
  alt: string;
  attribution: Array<{ label: string; url?: string | null }>;
}

export interface PlaceMedia {
  state: "PENDING" | "READY" | "DEGRADED" | "UNAVAILABLE" | "RIGHTS_BLOCKED" | "REVIEW_REQUIRED";
  primary?: PlaceMediaAsset | null;
  gallery: PlaceMediaAsset[];
  fallbackKind?: "LOCATION" | null;
}

export interface Place {
  priceEvidence?: { amountVnd: number; basis: "PER_PERSON_VISIT" | "PER_PERSON_NIGHT"; sourceUrl: string; observedAt: string };
  dailyBudgetExceeded?: boolean;
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
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  photos: string[];
  primaryPhoto?: PlacePhotoEvidence;
  photoGallery?: PlacePhotoEvidence[];
  media?: PlaceMedia;
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

export type PlaceBrowseCategory = "FOOD" | "CAFE" | "STAY" | "ATTRACTION";

export interface PlaceSearchParams {
  q: string;
  category?: PlaceBrowseCategory;
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
    category?: PlaceBrowseCategory;
    returned?: number;
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
