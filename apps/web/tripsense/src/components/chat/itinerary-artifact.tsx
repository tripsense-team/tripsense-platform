"use client";

import type { TripProposal } from "@/lib/types";
import { useActiveChat } from "@/hooks/use-active-chat";
import { ItineraryPreview } from "./itinerary-preview";

interface ItineraryArtifactContentProps {
  proposal: TripProposal;
}

export function ItineraryArtifactContent({
  proposal,
}: ItineraryArtifactContentProps) {
  const { chatId } = useActiveChat();
  return (
    <div className="h-full overflow-y-auto bg-background p-4">
      <ItineraryPreview proposal={proposal} chatId={chatId} />
    </div>
  );
}
