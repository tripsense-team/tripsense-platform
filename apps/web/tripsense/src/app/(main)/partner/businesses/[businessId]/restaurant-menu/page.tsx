"use client";

import { useParams } from "next/navigation";
import { RestaurantMenuView } from "@/features/partner";

export default function RestaurantMenuPage() {
  const params = useParams<{ businessId: string }>();
  return <RestaurantMenuView businessId={params.businessId} />;
}
