"use client";

import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { HotelCommerce } from "@/features/hotels";

export default function PartnerHotelCommercePage() {
  const { businessId } = usePartnerHotel();

  return (
    <div className="space-y-4">
      <HotelCommerce businessId={businessId} admin={false} />
    </div>
  );
}
