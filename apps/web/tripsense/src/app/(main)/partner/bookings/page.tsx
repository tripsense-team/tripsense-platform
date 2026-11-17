"use client";

import * as React from "react";
import { PartnerBookingsView } from "@/features/partner";

export default function PartnerBookingsPage() {
  return (
    <React.Suspense fallback={null}>
      <PartnerBookingsView />
    </React.Suspense>
  );
}
