import { HotelWorkspace } from "@/features/hotels";
import { Suspense } from "react";

export default function HotelsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HotelWorkspace />
    </Suspense>
  );
}
