"use client";

import { useParams } from "next/navigation";
import { GuideInquiriesListView } from "@/features/partner";

export default function BusinessGuideInquiriesPage() {
  const params = useParams<{ businessId: string }>();
  return <GuideInquiriesListView businessId={params.businessId} />;
}
