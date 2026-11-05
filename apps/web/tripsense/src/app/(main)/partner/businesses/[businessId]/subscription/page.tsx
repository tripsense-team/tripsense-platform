"use client";

import { useParams } from "next/navigation";
import { PartnerSubscriptionView } from "@/features/partner";

export default function PartnerSubscriptionPage() {
  const params = useParams<{ businessId: string }>();
  return <PartnerSubscriptionView businessId={params.businessId} showBackButton={true} />;
}
