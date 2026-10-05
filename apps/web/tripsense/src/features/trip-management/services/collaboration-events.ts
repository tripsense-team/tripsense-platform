import { authenticatedFetch } from "@/services/api-client";
import type { CollaborationChangeEvent } from "../types";

export interface CollaborationEventCallbacks {
  onConnected?: (revision: number) => void;
  onEvent: (event: CollaborationChangeEvent) => void;
  onResyncRequired: () => void | Promise<void>;
}

export async function streamCollaborationEvents(
  tripId: string,
  afterRevision: number,
  callbacks: CollaborationEventCallbacks,
  signal: AbortSignal,
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/trips/${encodeURIComponent(tripId)}/collaboration/events?afterRevision=${afterRevision}`,
    {
      headers: {
        Accept: "text/event-stream",
        "Last-Event-ID": String(afterRevision),
      },
      signal,
    },
  );

  if (response.status === 410) {
    await callbacks.onResyncRequired();
    return;
  }
  if (!response.ok || !response.body) {
    throw new Error("Collaboration stream is unavailable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      parseCollaborationEventFrame(frame, callbacks);
      boundary = buffer.indexOf("\n\n");
    }
  }
}

export function parseCollaborationEventFrame(
  frame: string,
  callbacks: CollaborationEventCallbacks,
): void {
  if (!frame || frame.startsWith(":")) return;
  let eventName = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return;

  const parsed = JSON.parse(data.join("\n")) as unknown;
  if (eventName === "trip.connected") {
    const revision = Number((parsed as { revision?: unknown }).revision ?? 0);
    callbacks.onConnected?.(revision);
    return;
  }
  if (eventName === "trip-change" && isCollaborationEvent(parsed)) {
    callbacks.onEvent(parsed);
  }
}

function isCollaborationEvent(value: unknown): value is CollaborationChangeEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CollaborationChangeEvent>;
  return (
    typeof candidate.eventId === "string" &&
    typeof candidate.tripId === "string" &&
    typeof candidate.revision === "number" &&
    typeof candidate.type === "string"
  );
}
