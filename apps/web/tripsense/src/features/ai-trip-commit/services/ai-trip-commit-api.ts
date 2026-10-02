import { authenticatedFetch } from "@/services/api-client";
import type {
  ApplyProposalResult,
  ChatTripContext,
  PlanningBriefResponse,
  TripBriefState,
  TripPlanningBrief,
} from "../types";
import { aiApiUrl } from "@/lib/ai-service-url";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("REQUEST_FAILED");
  }
  return payload as T;
}

export async function getPlanningBrief(chatId: string) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${chatId}/planning-brief`),
  );
  return readJson<PlanningBriefResponse>(response);
}

export async function patchPlanningBrief(input: {
  chatId: string;
  expectedVersion: number;
  patch: Partial<TripPlanningBrief>;
}) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${input.chatId}/planning-brief`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        patch: input.patch,
      }),
    },
  );
  return readJson<{
    accepted: true;
    state: TripBriefState;
    trip?: {
      id: string;
      name: string;
      operationId?: string;
      replayed?: boolean;
    };
  }>(response);
}

export async function cancelPlanningBrief(chatId: string) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${chatId}/planning-brief/cancel`),
    { method: "POST" },
  );
  return readJson<{ accepted: true; state: TripBriefState }>(response);
}

export async function retryPlanningBrief(chatId: string) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${chatId}/planning-brief/retry`),
    { method: "POST" },
  );
  return readJson<{ accepted: true; state: TripBriefState }>(response);
}

export async function getChatTripContext(chatId: string) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${chatId}/context`),
  );
  return readJson<ChatTripContext>(response);
}

export async function linkChatToTrip(
  chatId: string,
  tripId: string,
  expectedTripId: string | null,
) {
  const response = await authenticatedFetch(
    aiApiUrl(`/chats/${chatId}/trip`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, expectedTripId }),
    },
  );
  return readJson<{ chatId: string; tripId: string; linked: boolean }>(response);
}

export async function applyTripProposal(input: {
  chatId: string;
  proposalId: string;
  action: "CREATE_TRIP" | "ADD_TO_LINKED_TRIP";
  expectedTripRevision?: number | null;
  idempotencyKey?: string;
}) {
  const response = await authenticatedFetch(
    aiApiUrl(`/proposals/${input.proposalId}/apply`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey ?? crypto.randomUUID(),
      },
      body: JSON.stringify({
        chatId: input.chatId,
        action: input.action,
        expectedTripRevision: input.expectedTripRevision ?? null,
      }),
    },
  );
  return readJson<ApplyProposalResult>(response);
}
