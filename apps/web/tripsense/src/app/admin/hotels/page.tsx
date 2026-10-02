"use client";

import Link from "next/link";
import { HotelManagement } from "@/features/hotels";
import { Button } from "@/components/ui/button";
import { Building2, DollarSign } from "lucide-react";
import { useTranslation } from "@/i18n";

export default function AdminHotelsPage() {
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
              {t("trip.hotels.admin", { defaultValue: "Quản trị cơ sở lưu trú" })}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("trip.hotels.adminSubtitle", { defaultValue: "Xét duyệt và kiểm định chất lượng các cơ sở lưu trú đăng ký" })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/admin/hotels/commerce">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{t("trip.commerce.title", { defaultValue: "Đối soát thanh toán" })}</span>
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="text-xs">
            <Link href="/admin/partners">
              <span>{t("trip.commerce.partnerReview", { defaultValue: "Xét duyệt đối tác" })}</span>
            </Link>
          </Button>
        </div>
      </div>

      <HotelManagement admin={true} />
    </div>
  );
}
