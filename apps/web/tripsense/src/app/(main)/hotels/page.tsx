import { Suspense } from "react";
import { ServiceDiscoveryWorkspace } from "@/features/partner";

export default function HotelsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ServiceDiscoveryWorkspace defaultCategory="hotels" />
    </Suspense>
  );
}
