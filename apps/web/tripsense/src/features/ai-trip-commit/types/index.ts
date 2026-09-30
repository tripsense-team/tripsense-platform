export interface ChatTripContext {
  chatId: string;
  trip: {
    id: string;
    name: string;
    revision: number;
    destinationName?: string;
    startDate?: string;
    endDate?: string;
    travelerCount?: number | null;
    budgetAmount?: number | null;
    budgetCurrency?: string | null;
  } | null;
  committedSourceRefs: Array<{
    proposalId: string;
    itemKey: string;
    itineraryItemId: string;
  }>;
}

export type TripPlanningBrief = {
  where?: { destinationText: string; destinationPlaceRef?: string | null };
  when?: { startDate: string; endDate: string };
  who?: { adults: number; children: number; infants: number; pets: number };
  budget?:
    | { mode: "FLEXIBLE" }
    | { mode: "TOTAL"; amount: number; currency: string };
};

export interface TripBriefState {
  type: "data-tripBrief";
  runId: string;
  intentMessageId: string;
  version: number;
  status: string;
  brief: TripPlanningBrief;
  missingFields: Array<"WHERE" | "WHEN" | "WHO" | "BUDGET">;
  nextQuestion?: "WHERE" | "WHEN" | "WHO" | "BUDGET";
  tripId?: string;
  safeErrorCode?: string;
}

export interface PlanningBriefResponse {
  chatId: string;
  state: TripBriefState | null;
  trip: {
    id: string;
    name: string;
    destinationName: string;
    startDate: string;
    endDate: string;
    travelerCount: number | null;
    budgetAmount: number | null;
    budgetCurrency: string | null;
  } | null;
}

export interface ApplyProposalResult {
  operationId: string;
  status: string;
  action: "CREATE_TRIP" | "ADD_TO_TRIP";
  tripId: string;
  tripName: string;
  tripRevision: number;
  appliedCount: number;
  skippedCount: number;
  items: Array<{ itemKey: string; itineraryItemId: string; status: string }>;
  replayed: boolean;
  chatId: string;
}
