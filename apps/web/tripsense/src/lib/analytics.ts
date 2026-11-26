import { sendGAEvent } from "@next/third-parties/google";

export type TripSenseAnalyticsEvent =
  | { name: "login"; params: { method: "email" | "google" } }
  | { name: "sign_up"; params: { method: "email" | "google" } }
  | {
      name: "view_place";
      params: { place_id: string; category?: string; city?: string };
    }
  | { name: "create_trip"; params: { source: "manual" | "ai" | "clone" } }
  | { name: "send_ai_prompt"; params: { has_trip_context: boolean } }
  | {
      name: "create_booking";
      params: { booking_type: "hotel" | "restaurant" | "rental" };
    }
  | {
      name: "payment_success";
      params: { currency: string; payment_method: "payos" };
    };

/**
 * Returns the configured GA4 Measurement ID when analytics is enabled.
 */
export function getGaMeasurementId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id ? id : undefined;
}

/**
 * Dispatches a non-PII GA4 event when running in the browser with GA4 configured.
 * Silently no-ops on SSR, when unconfigured, or if gtag fails.
 */
export function trackEvent<E extends TripSenseAnalyticsEvent>(
  event: E["name"],
  params: E["params"],
): void {
  if (typeof window === "undefined" || !getGaMeasurementId()) {
    return;
  }

  try {
    sendGAEvent("event", event, params);
  } catch {
    // Analytics must never interrupt user flows.
  }
}

