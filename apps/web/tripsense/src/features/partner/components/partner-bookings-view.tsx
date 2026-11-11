"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Store, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getPartnerContext } from "../services/partner-api";
import { PartnerEnrollmentBanner } from "./partner-enrollment-banner";
import { PartnerBookingsHub } from "./partner-bookings-hub";
import type { BusinessDetailDto } from "../types";

export function PartnerBookingsView() {
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isPartner = isUserPartner(user);
  const searchParams = useSearchParams();

  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const initialBusinessId = searchParams.get("businessId") || undefined;

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPartnerContext();
      setBusinesses(res.businesses || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách cơ sở.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (isPartner) {
      void loadData();
    } else {
      setLoading(false);
    }
  }, [isAuthLoading, isPartner, loadData]);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Dedicated Header for Order & Booking Management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Quản lý Đơn đặt & Booking
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Tiếp nhận, xác nhận đặt phòng, đặt bàn, bàn giao xe cho thuê và phản hồi khách hàng tập trung.
          </p>
        </div>

        {isPartner && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-1.5">
              <Link href="/partner">
                <Store className="h-3.5 w-3.5" />
                <span>Cơ sở kinh doanh</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 text-xs gap-1.5">
              <Link href="/partner/services">
                <Layers className="h-3.5 w-3.5" />
                <span>Dịch vụ & Thực đơn</span>
              </Link>
            </Button>
          </div>
        )}
      </div>

      {!isAuthLoading && !isPartner ? (
        <PartnerEnrollmentBanner onEnrolled={loadData} />
      ) : loading ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải danh sách đơn đặt của đối tác...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <PartnerBookingsHub
          businesses={businesses}
          initialBusinessId={initialBusinessId}
          onRefreshBusinesses={loadData}
        />
      )}
    </div>
  );
}
