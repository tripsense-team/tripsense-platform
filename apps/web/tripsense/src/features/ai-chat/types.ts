import type { PlacePhotoEvidence } from "@/features/places/types";

export type AiArtifact = { artifactId: string; schemaVersion: number; type: "PLACE_LIST" | "PLACE_CARD" | "TRIP_CONTEXT" | "ITINERARY_CONTEXT" | "ITINERARY_PREVIEW" | string; version: number; data: Record<string, unknown>; provenance?: Array<Record<string, unknown>> };
export type AgentActivityStage = "UNDERSTAND" | "SEARCH" | "EVALUATE" | "BUILD" | "ROUTE" | "VERIFY";
export type AgentActivityStatus = "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
export type AgentActivityKind =
  | "UNDERSTANDING_REQUEST"
  | "RESOLVING_CONTEXT"
  | "SEARCHING_PLACES"
  | "SEARCHING_CURRENT_SOURCES"
  | "COMPARING_EVIDENCE"
  | "COMPARING_GEOGRAPHIC_FIT"
  | "BUILDING_ITINERARY"
  | "REVISING_ITINERARY"
  | "OPTIMIZING_ROUTE"
  | "VERIFYING_CONSTRAINTS"
  | "VERIFYING_EVIDENCE";
export type AgentActivity = {
  schemaVersion: 1;
  activityId: string;
  requirementId?: string;
  stage: AgentActivityStage;
  kind: AgentActivityKind | string;
  status: AgentActivityStatus;
  label: string;
  summary?: string;
  progress?: { found?: number; accepted?: number; rejected?: number };
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};
export type AiMessage = { id: string; role: "user" | "assistant"; content: string; artifacts?: AiArtifact[]; activities?: AgentActivity[]; createdAt?: string };
export type AiConversation = { id: string; title?: string; locale?: string; status: string; updatedAt: string };
export type AcceptedRun = { messageId: string; runId: string; status: string; streamUrl: string };
export type AiRun = { id: string; status: string; assistantMessageId?: string; executionProfile?: string; contextSufficiency?: string; retrievalSufficiency?: string; terminationReason?: string; counters?: Record<string, unknown>; error?: { code: string; message: string; retryable: boolean } };
export type AiStreamEvent = { type: string; sequence?: number; payload: Record<string, unknown> };
export type AiProposal = { id: string; targetTripId: string; businessState: string; processingState?: string; payloadHash: string; expiresAt: string; validation?: { issues?: Array<{ code?: string; message?: string }> }; receipt?: Record<string, unknown> };

export type AiPlaceEvidence = {
  canonicalPlaceId: string;
  title: string;
  address?: string;
  startTime?: string;
  endTime?: string;
  location?: { lat: number; lng: number };
  ratingSummary?: { value: number; count?: number | null; source?: string; fetchedAt?: string | null };
  primaryPhoto?: PlacePhotoEvidence;
  freshness?: string;
  cost?: { kind: "VERIFIED" | "ESTIMATED" | "UNKNOWN"; amount?: number; currency?: string; source?: string };
  fieldEvidence?: Record<string, { source?: string; fetchedAt?: string | null; confidenceClass: "VERIFIED" | "STALE" | "INFERRED" | "UNKNOWN" }>;
};

export function isDevelopmentFixturePlace(place: {
  id?: string;
  canonicalPlaceId?: string;
  name?: string;
  title?: string;
  provider?: string;
}): boolean {
  const id = place.id || place.canonicalPlaceId || "";
  const name = place.name || place.title || "";
  return id.startsWith("fixture-son-tra-")
    || place.provider === "tripsense-dev-fixture"
    || name.startsWith("TripSense Test ");
}

export type AiItineraryDay = {
  dayNumber: number;
  date?: string;
  items: AiPlaceEvidence[];
  weather?: { condition?: string; temperatureC?: number; isIllustrative?: boolean };
  routes?: unknown[];
};
export type AiItineraryPreview = {
  status?: string;
  validityState?: "VALID" | "PARTIAL" | "BLOCKED" | "INVALID";
  canRenderPreview?: boolean;
  canCommit?: boolean;
  validForPreview?: boolean;
  committable?: boolean;
  days?: AiItineraryDay[];
  issues?: Array<{ code?: string; severity?: string; message?: string }>;
  constraints?: { destination?: string; hardBudgetAmount?: number; budgetCurrency?: string };
  explanation?: string;
};
