import { describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/services/api-client", () => ({
  authenticatedFetch,
  apiClient: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import { streamRun } from "./ai-api";

describe("streamRun", () => {
  it("parses fragmented multiline SSE and deduplicates persisted sequences", async () => {
    const encoded = new TextEncoder().encode(
      'id: 1\nevent: assistant.delta\ndata: {"type":"assistant.delta","sequence":1,"payload":{"textDelta":"Hi"}}\n\n' +
      'id: 1\nevent: assistant.delta\ndata: {"type":"assistant.delta","sequence":1,"payload":{"textDelta":"duplicate"}}\n\n' +
      'id: 2\nevent: run.completed\ndata: {"type":"run.completed",\ndata: "sequence":2,"payload":{}}\n\n',
    );
    authenticatedFetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoded.slice(0, 37));
        controller.enqueue(encoded.slice(37));
        controller.close();
      },
    }), { status: 200, headers: { "Content-Type": "text/event-stream" } }));

    const events: string[] = [];
    const last = await streamRun("/api/ai/v1/runs/run-1/stream", (event) => events.push(event.type), new AbortController().signal);

    expect(events).toEqual(["assistant.delta", "run.completed"]);
    expect(last).toBe(2);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/ai/v1/runs/run-1/stream?afterSequence=0",
      expect.objectContaining({ headers: { Accept: "text/event-stream" } }),
    );
  });
});
