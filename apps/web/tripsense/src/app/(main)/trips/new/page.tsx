"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CreateTripModal } from "@/components/chat/modals/create-trip-modal";
import { useTranslation } from "@/i18n";
import type { TripResponse } from "@/features/trip-management/types";

export default function NewTripPage() {
  const router = useRouter();
  const { locale } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(true);

  const handleCreated = React.useCallback(
    (newTrip: TripResponse, prompt?: string) => {
      if (typeof window !== "undefined") {
        const defaultPrompt =
          prompt?.trim() ||
          (locale === "vi"
            ? `Hãy lên lịch trình chi tiết cho chuyến đi ${newTrip.destinationName} từ ngày ${newTrip.startDate} đến ${newTrip.endDate}.`
            : `Please plan a detailed itinerary for a trip to ${newTrip.destinationName} from ${newTrip.startDate} to ${newTrip.endDate}.`);
        sessionStorage.setItem("tripsense:initial-ai-prompt", defaultPrompt);
      }
      router.push(`/ai-planner?tripId=${newTrip.id}`);
    },
    [locale, router],
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <CreateTripModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          router.push("/trips");
        }}
        onTripCreated={handleCreated}
      />
    </div>
  );
}
