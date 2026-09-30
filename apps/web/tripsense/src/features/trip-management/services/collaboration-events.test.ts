import { describe, expect, it, vi } from "vitest";
import { parseCollaborationEventFrame } from "./collaboration-events";

describe("parseCollaborationEventFrame", () => {
  it("parses an ordered trip change", () => {
    const onEvent = vi.fn();
    parseCollaborationEventFrame(
      [
        "id: 8",
        "event: trip-change",
        'data: {"eventId":"event-8","schemaVersion":1,"tripId":"trip-1","revision":8,"type":"ITEM_UPDATED","actorUserId":"user-1","occurredAt":"2026-09-29T00:00:00Z","payload":{"itemId":"item-1"}}',
      ].join("\n"),
      { onEvent, onResyncRequired: vi.fn() },
    );

    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      tripId: "trip-1",
      revision: 8,
      type: "ITEM_UPDATED",
    });
  });

  it("ignores heartbeat comments and reports connection revision", () => {
    const onConnected = vi.fn();
    const callbacks = {
      onConnected,
      onEvent: vi.fn(),
      onResyncRequired: vi.fn(),
    };

    parseCollaborationEventFrame(":heartbeat", callbacks);
    parseCollaborationEventFrame(
      'event: trip.connected\ndata: {"tripId":"trip-1","revision":12}',
      callbacks,
    );

    expect(callbacks.onEvent).not.toHaveBeenCalled();
    expect(onConnected).toHaveBeenCalledWith(12);
  });
});
