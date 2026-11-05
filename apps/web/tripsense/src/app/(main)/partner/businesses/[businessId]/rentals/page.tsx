"use client";

import { useParams } from "next/navigation";
import { PartnerRentalsManagementView } from "@/features/partner";

export default function PartnerRentalsPage() {
  const params = useParams<{ businessId: string }>();
  return <PartnerRentalsManagementView businessId={params.businessId} />;
}

