import { describe, expect, it, vi } from "vitest";
import { subscribePartnerNotificationEvents } from "../services/partner-notification-events";

vi.mock("@/services/api-client", () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from "@/services/api-client";

describe("subscribePartnerNotificationEvents", () => {
  it("triggers onChanged callback when notification.changed event is received", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(": connected\n\nevent: notification.changed\ndata: {\"category\":\"PARTNER\"}\n\n"),
        );
        controller.close();
      },
    });

    (authenticatedFetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: stream,
    });

    const onChanged = vi.fn();
    const abortController = new AbortController();

    const promise = subscribePartnerNotificationEvents({
      onChanged,
      signal: abortController.signal,
    });

    // Abort after a moment to terminate the loop
    setTimeout(() => abortController.abort(), 50);

    await promise;

    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
