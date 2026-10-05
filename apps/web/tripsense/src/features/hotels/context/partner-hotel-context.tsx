"use client";

import * as React from "react";
import { getBusinessDetail } from "@/features/partner/services/partner-api";
import type { BusinessDetailDto } from "@/features/partner/types";
import { hotelApi } from "../services/hotels-api";
import type { HotelProperty } from "../types";
import { getSafeErrorMessage } from "@/services/error-sanitizer";

interface PartnerHotelContextValue {
  businessId: string;
  business: BusinessDetailDto | null;
  property: HotelProperty | null;
  myRole: "OWNER" | "MANAGER" | "STAFF" | null;
  isOwner: boolean;
  isManager: boolean;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

const PartnerHotelContext = React.createContext<PartnerHotelContextValue | undefined>(undefined);

export function PartnerHotelProvider({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const [business, setBusiness] = React.useState<BusinessDetailDto | null>(null);
  const [property, setProperty] = React.useState<HotelProperty | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const refresh = React.useCallback(async () => {
    setError("");
    try {
      const [biz, props] = await Promise.all([
        getBusinessDetail(businessId),
        hotelApi<HotelProperty[]>("/properties").catch(() => []),
      ]);
      setBusiness(biz);
      const matched = props.find((p) => p.business_id === businessId) || null;
      setProperty(matched);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const myRole = business?.myRole ?? null;
  const isOwner = myRole === "OWNER";
  const isManager = myRole === "MANAGER" || isOwner;

  const value: PartnerHotelContextValue = {
    businessId,
    business,
    property,
    myRole,
    isOwner,
    isManager,
    loading,
    error,
    refresh,
  };

  return (
    <PartnerHotelContext.Provider value={value}>
      {children}
    </PartnerHotelContext.Provider>
  );
}

export function usePartnerHotel() {
  const context = React.useContext(PartnerHotelContext);
  if (!context) {
    throw new Error("usePartnerHotel must be used within a PartnerHotelProvider");
  }
  return context;
}
