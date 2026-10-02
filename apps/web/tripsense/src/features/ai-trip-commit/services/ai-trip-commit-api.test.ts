import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedFetch = vi.hoisted(() => vi.fn());
vi.mock("@/services/api-client", () => ({ authenticatedFetch }));

import {
  applyTripProposal,
  getChatTripContext,
  getPlanningBrief,
  linkChatToTrip,
  patchPlanningBrief,
} from "./ai-trip-commit-api";

describe("ai trip commit API", () => {
  beforeEach(() => authenticatedFetch.mockReset());

  it("loads authoritative chat trip context", async () => {
    const payload = { chatId: "chat-1", trip: null, committedSourceRefs: [] };
    authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(getChatTripContext("chat-1")).resolves.toEqual(payload);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      expect.stringContaining("/chats/chat-1/context"),
    );
  });

  it("loads the persisted planning brief", async () => {
    const payload = {
      chatId: "chat-1",
      state: { status: "COLLECTING", brief: {}, missingFields: ["WHERE"] },
      trip: null,
    };
    authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );

    await expect(getPlanningBrief("chat-1")).resolves.toEqual(payload);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      expect.stringContaining("/chats/chat-1/planning-brief"),
    );
  });

  it("patches a planning brief with optimistic versioning", async () => {
    authenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ accepted: true, state: { version: 4 } }),
        { status: 200 },
      ),
    );

    await patchPlanningBrief({
      chatId: "chat-1",
      expectedVersion: 3,
      patch: { where: { destinationText: "Da Nang" } },
    });

    const init = authenticatedFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      expectedVersion: 3,
      patch: { where: { destinationText: "Da Nang" } },
    });
  });

  it("uses optimistic link expectation", async () => {
    authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ linked: true }), { status: 200 }),
    );
    await linkChatToTrip("chat-1", "trip-1", null);

    const init = authenticatedFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      tripId: "trip-1",
      expectedTripId: null,
    });
  });

  it("sends an idempotency key when applying a proposal", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "operation-key" });
    authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ operationId: "op-1" }), { status: 200 }),
    );
    await applyTripProposal({
      chatId: "chat-1",
      proposalId: "proposal-1",
      action: "CREATE_TRIP",
      idempotencyKey: "operation-key",
    });

    const init = authenticatedFetch.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("operation-key");
    vi.unstubAllGlobals();
  });

  it("does not expose downstream error details", async () => {
    authenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "FAILED" } }), { status: 502 }),
    );
    await expect(getChatTripContext("chat-1")).rejects.toThrow("REQUEST_FAILED");
  });
});
