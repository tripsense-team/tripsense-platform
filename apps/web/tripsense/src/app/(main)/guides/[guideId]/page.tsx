"use client";

import { useParams } from "next/navigation";
import { PublicGuideProfileView } from "@/features/partner";

export default function PublicGuidePage() {
  const params = useParams<{ guideId: string }>();
  return <PublicGuideProfileView guideId={params.guideId} />;
}
