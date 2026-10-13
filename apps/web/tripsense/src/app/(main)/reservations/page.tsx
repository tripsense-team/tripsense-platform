"use client";

import * as React from "react";
import { Suspense } from "react";
import { UnifiedReservationsHub } from "@/features/reservations";
import { Loader2 } from "lucide-react";

export default function ReservationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <UnifiedReservationsHub />
    </Suspense>
  );
}
