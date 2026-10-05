"use client";

import { useParams } from "next/navigation";
import { TripSharingWorkspace } from "@/features/social-post";

export default function TripDetailPage() {
  const params = useParams<{ tripId: string }>();
  return <TripSharingWorkspace initialTripId={params.tripId} />;
}
