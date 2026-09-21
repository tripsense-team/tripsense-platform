import { apiClient, authenticatedFetch, ApiError } from "@/services/api-client";
import type { AcceptedRun, AiConversation, AiMessage, AiProposal, AiRun, AiStreamEvent } from "./types";

export const aiApi = {
  listConversations: () => apiClient<{ items: AiConversation[] }>("/api/ai/v1/conversations"),
  createConversation: (title?: string) => apiClient<AiConversation>("/api/ai/v1/conversations", { method: "POST", body: JSON.stringify({ title }) }),
  listMessages: (id: string) => apiClient<{ items: AiMessage[]; activeRunId?: string }>(`/api/ai/v1/conversations/${id}/messages`),
  getRun: (id: string) => apiClient<AiRun>(`/api/ai/v1/runs/${id}`),
  cancelRun: (id: string) => apiClient<AiRun>(`/api/ai/v1/runs/${id}/cancel`, { method: "POST" }),
  sendMessage: (id: string, content: string, clientMessageId: string, tripId?: string) => apiClient<AcceptedRun>(`/api/ai/v1/conversations/${id}/messages`, {
    method: "POST", headers: { "Idempotency-Key": clientMessageId },
    body: JSON.stringify({ content, clientMessageId, intent: "NORMAL", locale: navigator.language, tripId }),
  }),
  getProposal: (id: string) => apiClient<AiProposal>(`/api/ai/v1/proposals/${id}`),
  confirmProposal: (id: string) => apiClient<AiProposal>(`/api/ai/v1/proposals/${id}/confirm`, {
    method: "POST", headers: { "Idempotency-Key": `proposal-${id}` },
  }),
  rejectProposal: (id: string) => apiClient<AiProposal>(`/api/ai/v1/proposals/${id}/reject`, { method: "POST" }),
  sendFeedback: (artifactId: string, candidateId: string, action: "SAVE" | "REJECT" | "MORE_LIKE_THIS") =>
    apiClient(`/api/ai/v1/artifacts/${artifactId}/feedback`, {
      method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ candidateId, action }),
    }),
};

export async function streamRun(url: string, onEvent: (event: AiStreamEvent) => void, signal: AbortSignal, afterSequence = 0) {
  const separator = url.includes("?") ? "&" : "?";
  const response = await authenticatedFetch(`${url}${separator}afterSequence=${afterSequence}`, { signal, headers: { Accept: "text/event-stream" } });
  if (!response.ok || !response.body) throw new ApiError("Unable to open AI stream", response.status, await response.text());
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let lastSequence = afterSequence;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true }); const blocks = buffer.split("\n\n"); buffer = blocks.pop() || "";
    for (const block of blocks) {
      const lines = block.split("\n");
      const type = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
      const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
      if (!type || !data) continue;
      const parsed = JSON.parse(data); const event = (parsed.type ? parsed : { type, payload: parsed }) as AiStreamEvent;
      if (event.sequence !== undefined && event.sequence <= lastSequence) continue;
      if (event.sequence !== undefined) lastSequence = event.sequence;
      onEvent(event);
    }
  }
  return lastSequence;
}
