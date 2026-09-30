import type { UIMessage } from "ai";
import { z } from "zod";

export const messageMetadataSchema = z.object({
  createdAt: z.string().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export type ChatTools = Record<string, any>;

export type WaitingStatusData = {
  phase: "waiting" | "still-waiting" | "health" | "thinking";
  message: string;
  modelId: string;
  modelName: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  kind?: string;
  clear: null;
  finish: null;
  "chat-title": string;
  "waiting-status": WaitingStatusData;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};

// Travel Domain Types for Phase 4
export interface PlaceSearchResult {
  id: string;
  name: string;
  address?: string;
  city?: string;
  categories: string[];
  location?: { lat: number; lng: number };
  photoUrl?: string;
  rating?: number;
  phone?: string;
}

export interface TripActivity {
  itemKey: string;
  period: "MORNING" | "AFTERNOON" | "EVENING" | "FLEXIBLE";
  timeSlot: string;
  title: string;
  description: string;
  placeId?: string;
  address?: string;
  category?: string;
  estimatedCost?: string;
}

export interface TripDayPlan {
  dayNumber: number;
  theme: string;
  activities: TripActivity[];
}

export interface TripProposal {
  proposalId: string;
  title: string;
  destination: string;
  durationDays: number;
  estimatedBudget?: string;
  summary: string;
  days: TripDayPlan[];
  status?: "PENDING" | "PARTIALLY_APPLIED" | "APPLIED";
  autoCommit?:
    | {
        status: "APPLIED";
        operationId: string;
        tripId: string;
        appliedCount: number;
        committedItemKeys: string[];
      }
    | { status: "FAILED_RETRYABLE"; safeErrorCode: string };
}

export type UIArtifact = {
  title: string;
  documentId: string;
  kind: "itinerary";
  proposal: TripProposal;
  isVisible: boolean;
  status: "idle" | "streaming";
};
