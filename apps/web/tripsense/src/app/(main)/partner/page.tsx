"use client";

import * as React from "react";
import { PartnerDashboardView } from "@/features/partner";

export default function PartnerPage() {
  return (
    <React.Suspense fallback={null}>
      <PartnerDashboardView />
    </React.Suspense>
  );
}
