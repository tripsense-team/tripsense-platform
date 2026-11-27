import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationFeedbackBuffer } from "./recommendation-feedback-buffer";

describe("RecommendationFeedbackBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => `event-${Math.random()}`) });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces the same weak semantic event", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const buffer = new RecommendationFeedbackBuffer(send);
    const event = {
      recommendationId: "rec-1",
      placeId: "place-1",
      eventType: "CLICK" as const,
      position: 1,
    };

    expect(buffer.enqueue(event)).toBe(true);
    expect(buffer.enqueue(event)).toBe(false);
    await buffer.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toHaveLength(1);
  });

  it("sends one hundred distinct events in five batches of twenty", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const buffer = new RecommendationFeedbackBuffer(send);

    for (let index = 0; index < 100; index += 1) {
      buffer.enqueue({
        recommendationId: `rec-${Math.floor(index / 20)}`,
        placeId: `place-${index}`,
        eventType: "IMPRESSION",
        position: (index % 20) + 1,
      });
    }
    await buffer.flush();

    expect(send).toHaveBeenCalledTimes(5);
    expect(send.mock.calls.every(([events]) => events.length === 20)).toBe(true);
  });

  it("reuses stable event IDs for one bounded retry", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce(undefined);
    const buffer = new RecommendationFeedbackBuffer(send, { retryDelayMs: 10 });
    buffer.enqueue({
      recommendationId: "rec-1",
      placeId: "place-1",
      eventType: "DETAIL_VIEW",
      position: 1,
    });

    const flushing = buffer.flush();
    await vi.advanceTimersByTimeAsync(10);
    await flushing;

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0][0].eventId).toBe(send.mock.calls[0][0][0].eventId);
  });

  it("flushes automatically after five seconds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const buffer = new RecommendationFeedbackBuffer(send);
    buffer.enqueue({
      recommendationId: "rec-1",
      placeId: "place-1",
      eventType: "CLICK",
      position: 1,
    });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
