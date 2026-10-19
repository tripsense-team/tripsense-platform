import { authenticatedFetch } from "@/services/api-client";

export interface NotificationStreamOptions {
  onChanged: () => void;
  signal: AbortSignal;
}

export async function subscribePartnerNotificationEvents({
  onChanged,
  signal,
}: NotificationStreamOptions): Promise<void> {
  let retryDelay = 1000;

  while (!signal.aborted) {
    try {
      const response = await authenticatedFetch(
        "/api/partners/notifications/events",
        {
          headers: {
            Accept: "text/event-stream",
          },
          signal,
        },
      );

      if (!response.ok || !response.body) {
        throw new Error(`SSE response not ok: ${response.status}`);
      }

      // Successful connection resets backoff
      retryDelay = 1000;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          if (frame && !frame.startsWith(":")) {
            const lines = frame.split("\n");
            let isChangedEvent = false;

            for (const line of lines) {
              if (line.startsWith("event:") && line.slice(6).trim() === "notification.changed") {
                isChangedEvent = true;
              }
            }

            if (isChangedEvent) {
              onChanged();
            }
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // Avoid logging sensitive tokens or crashing; back off before reconnecting
      if (signal.aborted) return;
    }

    if (!signal.aborted) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(30000, retryDelay * 2);
    }
  }
}
