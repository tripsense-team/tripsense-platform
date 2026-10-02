"use client";

import { useParams } from "next/navigation";
import { GuidePromotionsView } from "@/features/partner";

export default function BusinessGuidePromotionsPage() {
  const params = useParams<{ businessId: string }>();
  return <GuidePromotionsView businessId={params.businessId} />;
}
