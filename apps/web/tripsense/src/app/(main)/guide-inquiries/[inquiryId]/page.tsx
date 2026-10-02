"use client";

import { useParams } from "next/navigation";
import { GuideInquiryDetailView } from "@/features/partner";

export default function GuideInquiryDetailPage() {
  const params = useParams<{ inquiryId: string }>();
  return <GuideInquiryDetailView inquiryId={params.inquiryId} />;
}
