"use client";

import * as React from "react";
import { AdminFinanceView } from "./admin-finance-view";
import { PartnerFinanceView } from "./partner-finance-view";

export function HotelCommerce({
  businessId,
  admin = false,
}: {
  businessId?: string;
  admin?: boolean;
} = {}) {
  if (admin) {
    return <AdminFinanceView />;
  }

  return <PartnerFinanceView businessId={businessId} />;
}
