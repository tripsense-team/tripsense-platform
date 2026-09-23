export type PlaceIntent = "VISITED" | "WANT_TO_VISIT";

export interface HomeCityData {
  name: string;
  placeRef: string;
  country?: string;
}

export interface OnboardingProfile {
  version: number;
  status: "IN_PROGRESS" | "COMPLETED";
  selections: Record<string, string[]>;
  places: Partial<Record<PlaceIntent, string[]>>;
  attributes?: Record<string, string>;
  freeText?: string;
}

export interface UpdateOnboardingRequest {
  version: number;
  selections: Record<string, string[]>;
  places: Partial<Record<PlaceIntent, string[]>>;
  attributes?: Record<string, string>;
  freeText?: string;
}
