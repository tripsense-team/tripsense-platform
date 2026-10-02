"use client";

import Link from "next/link";
import { HotelCommerce } from "@/features/hotels";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function AdminHotelsCommercePage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Building2 className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("trip.commerce.title", { defaultValue: "Đối soát thanh toán & Quyết toán" })}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("trip.commerce.adminSubtitle", { defaultValue: "Xem số liệu đối soát toàn hệ thống và thực hiện quyết toán cho đối tác" })}
          </p>
        </div>

        <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
          <Link href="/admin/hotels">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{t("common.back", { defaultValue: "Quay lại" })}</span>
          </Link>
        </Button>
      </div>

      <HotelCommerce admin={true} />
    </div>
  );
}
