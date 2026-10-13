"use client";

import { useParams } from "next/navigation";
import { PublicRestaurantView } from "@/features/partner";

export default function PublicRestaurantPage() {
  const params = useParams<{ businessId: string }>();
  return <PublicRestaurantView businessId={params.businessId} />;
}
