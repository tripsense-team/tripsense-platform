"use client";

import { useParams } from "next/navigation";
import { TripManagementView } from "@/features/trip-management";

export default function TripDetailPage() {
  const params = useParams<{ tripId: string }>();
  return <TripManagementView screen="detail" initialTripId={params.tripId} />;
}
