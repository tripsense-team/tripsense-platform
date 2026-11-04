export type PlaceLifecycle = "ACTIVE" | "ARCHIVED";
export type PlaceSource = "MANUAL" | "PROVIDER";

export interface AdminPlaceSummary {
  id: string;
  name: string;
  city: string;
  primaryType: string | null;
  categories: string[];
  provider: string;
  managementSource: PlaceSource;
  lifecycleStatus: PlaceLifecycle;
  mediaState: string | null;
  coverPhotoUrl: string | null;
  version: number;
  updatedAt: string | null;
}

export interface AdminPlaceMutation {
  name: string;
  primaryType: string | null;
  categories: string[];
  location: { lat: number; lng: number };
  address: string;
  oldAddress: string | null;
  city: string;
  district: string | null;
  phone: string | null;
  website: string | null;
  socials: string[];
  openingHours: string | null;
  businessStatus: string | null;
  description: string | null;
}

export interface AdminPlaceDetail extends AdminPlaceSummary, AdminPlaceMutation {
  normalizedName: string;
  providerPlaceId: string;
  manualOverrideFields: string[];
  manualCreatedBy: string | null;
  lastEditedBy: string | null;
  lastAdminAction: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string | null;
}

export interface AdminPlacePage {
  items: AdminPlaceSummary[];
  nextCursor: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}
