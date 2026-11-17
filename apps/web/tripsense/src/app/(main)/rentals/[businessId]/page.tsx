"use client";

import { useParams } from "next/navigation";
import { PublicRentalView } from "@/features/partner";

export default function PublicRentalPage() {
  const params = useParams<{ businessId: string }>();
  return <PublicRentalView businessId={params.businessId} />;
}

