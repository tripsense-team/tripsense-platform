"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BedDouble,
  Compass,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getPartnerContext } from "@/features/partner/services/partner-api";
import type { BusinessDetailDto } from "@/features/partner/types";
import { PartnerSubscriptionView } from "@/features/partner/components/partner-subscription-view";

function PartnerSubscriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isPartner = isUserPartner(user);

  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestVersion = React.useRef(0);

  const loadBusinesses = React.useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const context = await getPartnerContext();
      if (version === requestVersion.current) {
        const list = Array.isArray(context.businesses) ? context.businesses : [];
        setBusinesses(list);

        const paramBizId = searchParams.get("businessId");
        if (paramBizId && list.some((b) => b.id === paramBizId)) {
          setSelectedBusinessId(paramBizId);
        } else if (list.length > 0) {
          setSelectedBusinessId(list[0].id);
        }
      }
    } catch (err: unknown) {
      if (version === requestVersion.current) {
        setError(getSafeErrorMessage(err, "Không thể tải thông tin cơ sở đối tác."));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (!isPartner) {
      requestVersion.current += 1;
      router.replace("/partner");
      return;
    }
    void Promise.resolve().then(() => loadBusinesses());
    return () => {
      requestVersion.current += 1;
    };
  }, [isAuthLoading, isPartner, user?.id, loadBusinesses, router]);

  if (!isAuthLoading && !isPartner) return null;

  if (loading) {
    return (
      <main className="container mx-auto flex min-h-[50vh] max-w-6xl flex-col items-center justify-center gap-3 px-4 py-12">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải gói dịch vụ và cơ sở đối tác...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadBusinesses()}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Thử lại
          </Button>
        </div>
      </main>
    );
  }

  if (businesses.length === 0) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-12">
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Store className="h-7 w-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Bạn chưa có cơ sở kinh doanh nào</h2>
              <p className="text-sm text-muted-foreground">
                Đăng ký cơ sở kinh doanh của bạn ngay để mở khóa các gói đối tác và tiếp cận hàng ngàn du khách trên TripSense với 0% hoa hồng!
              </p>
            </div>
            <Button asChild className="mt-2 gap-2">
              <Link href="/partner">
                <Plus className="h-4 w-4" /> Đăng ký cơ sở kinh doanh ngay
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      {/* Business Switcher Selector Bar if partner has multiple businesses */}
      {businesses.length > 1 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cơ sở đang xem gói:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {businesses.map((b) => {
              const isSelected = selectedBusinessId === b.id;
              const Icon = b.kind === "HOTEL" ? BedDouble : b.kind === "RESTAURANT" ? Utensils : Compass;
              return (
                <Button
                  key={b.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedBusinessId(b.id)}
                  className={`h-8 gap-1.5 text-xs font-medium transition-all cursor-pointer ${
                    isSelected ? "font-semibold shadow-xs" : "hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{b.displayName}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Render Subscription View for Selected Business */}
      {selectedBusinessId && (
        <PartnerSubscriptionView
          key={selectedBusinessId}
          businessId={selectedBusinessId}
          embedded={true}
          showBackButton={false}
        />
      )}
    </main>
  );
}

export default function PartnerSubscriptionPage() {
  return (
    <React.Suspense
      fallback={
        <main className="container mx-auto flex min-h-[50vh] max-w-6xl flex-col items-center justify-center gap-3 px-4 py-12">
          <Spinner className="h-8 w-8 text-primary" />
        </main>
      }
    >
      <PartnerSubscriptionContent />
    </React.Suspense>
  );
}
