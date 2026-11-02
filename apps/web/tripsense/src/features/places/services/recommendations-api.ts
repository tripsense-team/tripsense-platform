import { apiClient } from "@/services/api-client";
import { normalizePlace } from "./places-api";
import type { Place } from "../types";

export type ExploreFallbackLevel =
  | "EXACT"
  | "RELAXED_RETRIEVAL"
  | "DESTINATION_BASELINE"
  | "LAST_KNOWN_GOOD";

export type ExploreResultMode =
  | "PERSONALIZED"
  | "QUERY_PERSONALIZED"
  | "GENERIC_DESTINATION";

export interface ExploreRecommendationItem {
  place: Place;
  rank: number;
  score: number;
  availableCriteria: string[];
  reasons: Array<{ code: string; criterion: string }>;
}

export interface ExploreRecommendation {
  recommendationId: string;
  destinationId: string;
  committedQuery: string;
  queryApplied: boolean;
  resultMode: ExploreResultMode;
  fallbackLevel: ExploreFallbackLevel;
  stale: boolean;
  personalization: {
    enabled: boolean;
    applied: boolean;
    signalCount: number;
  };
  requestedCount: number;
  returnedCount: number;
  complete: boolean;
  rankingStatus: string;
  items: ExploreRecommendationItem[];
  degradations: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export type DiscoverySection = "ATTRACTION" | "HOMESTAY" | "FOOD" | "CAFE" | "STAY";
export interface SectionFeed {
  recommendationId: string;
  seedId: string | null;
  expiresAt: string;
  seedReused: boolean;
  previewOrderPreserved: boolean;
  destinationId: string;
  resultMode: "PERSONALIZED" | "GENERIC_DESTINATION";
  personalization: ExploreRecommendation["personalization"];
  stale: boolean;
  requestedCount: number;
  returnedCount: number;
  sections: Array<{
    category: DiscoverySection;
    status: "READY" | "EMPTY" | "ERROR";
    degradations: string[];
    items: ExploreRecommendationItem[];
  }>;
}

export async function getExploreSections(params: {
  destinationId: string;
  sessionId: string;
  section: DiscoverySection | null;
  seedId?: string | null;
  signal: AbortSignal;
}): Promise<SectionFeed> {
  const response = await apiClient<ApiResponse<SectionFeed>>(
    "/api/recommendations/explore-for-you/sections",
    {
      method: "POST",
      body: JSON.stringify({
        destinationId: params.destinationId,
        sessionId: params.sessionId,
        section: params.section,
        limit: params.section ? 48 : 4,
        seedId: params.seedId ?? null,
      }),
      signal: params.signal,
    },
  );
  return {
    ...response.data,
    sections: response.data.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, place: {
        ...normalizePlace(item.place),
        dailyBudgetExceeded: item.reasons?.some((reason) => reason.code === "DAILY_BUDGET_EXCEEDED") ?? false,
      } })),
    })),
  };
}

export async function getExploreForYou(params: {
  destinationId: string;
  query: string;
  sessionId: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<ExploreRecommendation> {
  const response = await apiClient<ApiResponse<ExploreRecommendation>>(
    "/api/recommendations/explore-for-you",
    {
      method: "POST",
      body: JSON.stringify({
        destinationId: params.destinationId,
        query: params.query.trim() || null,
        sessionId: params.sessionId,
        limit: params.limit ?? 20,
      }),
      signal: params.signal,
    },
  );
  return {
    ...response.data,
    items: response.data.items.map((item) => ({
      ...item,
      place: { ...normalizePlace(item.place),
        dailyBudgetExceeded: item.reasons?.some((reason) => reason.code === "DAILY_BUDGET_EXCEEDED") ?? false },
    })),
  };
}

export async function recordRecommendationEvent(params: {
  recommendationId: string;
  placeId: string;
  eventType:
    | "IMPRESSION"
    | "CLICK"
    | "DETAIL_VIEW"
    | "SAVE"
    | "UNSAVE"
    | "ADD_TO_TRIP"
    | "REMOVE_FROM_TRIP";
  position: number;
  idempotencyKey: string;
}): Promise<void> {
  await apiClient(`/api/recommendations/${params.recommendationId}/events`, {
    method: "POST",
    headers: { "Idempotency-Key": params.idempotencyKey },
    body: JSON.stringify({
      placeId: params.placeId,
      eventType: params.eventType,
      position: params.position,
      occurredAt: new Date().toISOString(),
    }),
  });
}
