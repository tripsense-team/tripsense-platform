"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Compass,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Utensils,
  ArrowRight,
  CheckCircle2,
  Building2,
  Layers,
  MapPin,
  Eye,
  BadgeCheck,
  Car,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { isUserPartner } from "@/features/auth/utils/role-helpers";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getPartnerContext } from "../services/partner-api";
import type { BusinessDetailDto } from "../types";

export function PartnerServicesHubView() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const isPartner = isUserPartner(user);

  const [businesses, setBusinesses] = React.useState<BusinessDetailDto[]>([]);
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
      }
    } catch (err: unknown) {
      if (version === requestVersion.current) {
        setError(getSafeErrorMessage(err, "Không thể tải thông tin cơ sở đối tác."));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

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
        <p className="text-sm text-muted-foreground">Đang tải danh mục dịch vụ đối tác...</p>
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
                Hãy đăng ký thông tin cơ sở kinh doanh miễn phí trước để bắt đầu thêm thực đơn, hạng phòng và dịch vụ của bạn trên TripSense.
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
    <main className="container mx-auto max-w-6xl space-y-8 px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Quản lý Dịch vụ & Thực đơn
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cấu hình danh mục món ăn, hạng phòng hoặc bài quảng bá tour để du khách có thể xem và liên hệ trực tiếp.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit gap-1.5">
          <Link href="/partner">
            <Store className="h-4 w-4" /> Danh sách cơ sở
          </Link>
        </Button>
      </div>

      {/* Funnel Step Helper Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                2
              </span>
              <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Bước 2 trong chu trình Đối tác: Hoàn tất danh mục dịch vụ
              </span>
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              Thêm thực đơn món ăn hoặc hạng phòng nghỉ cho cơ sở của bạn trước khi kích hoạt Gói Hội Viên Pro để thu hút du khách tối đa ngay khi mở bán.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-amber-700 dark:text-amber-300">
              <Link href="/partner/subscription">
                Xem quyền lợi Gói Pro <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* List of Businesses with Dedicated Catalog Actions */}
      <div className="grid gap-6">
        {businesses.map((business) => {
          const kind = business.kind;
          const address = (business.draftProfile?.addressLine as string) || "Chưa cập nhật địa chỉ";
          const city = (business.draftProfile?.city as string) || "";
          const fullLocation = city ? `${address}, ${city}` : address;

          return (
            <Card key={business.id} className="overflow-hidden border-border/80 shadow-2xs hover:shadow-xs transition-shadow">
              <CardHeader className="bg-muted/30 pb-4 border-b border-border/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      {kind === "HOTEL" && <Building2 className="h-5 w-5 text-blue-500" />}
                      {kind === "RESTAURANT" && <Utensils className="h-5 w-5 text-amber-500" />}
                      {kind === "TOUR_GUIDE" && <Compass className="h-5 w-5 text-emerald-500" />}
                      {kind === "RENTAL_SERVICE" && <Car className="h-5 w-5 text-teal-500" />}
                      <CardTitle className="text-lg font-bold text-foreground">
                        {business.displayName}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs font-medium">
                        {kind === "HOTEL" ? "Khách sạn / Lưu trú" : kind === "RESTAURANT" ? "Quán ăn / Nhà hàng" : kind === "RENTAL_SERVICE" ? "Dịch vụ cho thuê" : "Hướng dẫn viên du lịch"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground/80 shrink-0" />
                      <span className="truncate">{fullLocation}</span>
                    </div>
                  </div>

                  {/* Public Preview Button */}
                  <div className="flex items-center gap-2">
                    {kind === "RESTAURANT" && (
                      <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                        <Link href={`/restaurants/${business.id}`} target="_blank">
                          <Eye className="h-3.5 w-3.5" /> Xem trước trang du khách <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </Button>
                    )}
                    {kind === "HOTEL" && (
                      <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                        <Link href={`/hotels/${business.id}`} target="_blank">
                          <Eye className="h-3.5 w-3.5" /> Xem trước trang du khách <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Specific Catalog Details by Kind */}
                {kind === "RESTAURANT" && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          Thực đơn & Bảng giá tham khảo
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Tải ảnh chụp menu, bảng giá hoặc thêm một vài món đặc sắc của quán. Không bắt buộc phải nhập từng món lẻ.
                        </p>
                      </div>
                    </div>
                    <Button asChild className="shrink-0 gap-1.5">
                      <Link href={`/partner/businesses/${business.id}/restaurant-menu`}>
                        <Utensils className="h-4 w-4" /> Thực đơn & Bảng giá
                      </Link>
                    </Button>
                  </div>
                )}

                {kind === "HOTEL" && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <BedDouble className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          Hạng phòng & Tiện nghi lưu trú
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Cấu hình các hạng phòng (Standard, Deluxe, VIP), tiện ích phòng, giá niêm yết và tình trạng phòng trống.
                        </p>
                      </div>
                    </div>
                    <Button asChild className="shrink-0 gap-1.5">
                      <Link href={`/partner/businesses/${business.id}/hotel`}>
                        <BedDouble className="h-4 w-4" /> Quản lý Hạng phòng & Giá
                      </Link>
                    </Button>
                  </div>
                )}

                {kind === "TOUR_GUIDE" && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Compass className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          Bài giới thiệu Tour & Trải nghiệm
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Đăng tải bài viết quảng bá lộ trình tour, thông tin ngôn ngữ, kinh nghiệm bản địa và tiếp nhận yêu cầu từ du khách.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button asChild variant="default" className="gap-1.5">
                        <Link href={`/partner/businesses/${business.id}/guide-promotions`}>
                          <Compass className="h-4 w-4" /> Bài quảng bá tour
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="gap-1.5">
                        <Link href={`/partner/businesses/${business.id}/guide-inquiries`}>
                          Hộp thư tư vấn
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {kind === "RENTAL_SERVICE" && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        <Car className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          Phương tiện & Dịch vụ cho thuê
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Quản lý xe máy, ô tô tự lái, lều trại dã ngoại, ván chèo SUP, thiết lập số lượng tồn kho và đơn giá theo ngày.
                        </p>
                      </div>
                    </div>
                    <Button asChild className="shrink-0 gap-1.5 bg-teal-600 hover:bg-teal-700 text-white">
                      <Link href={`/partner/businesses/${business.id}/rentals`}>
                        <Car className="h-4 w-4" /> Quản lý Danh mục cho thuê
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 bg-muted/15 px-6 py-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Bước tiếp theo sau khi có dịch vụ: Nâng cấp gói Pro để nhận Tích xanh & Ưu tiên đề xuất AI</span>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/10">
                  <Link href={`/partner/businesses/${business.id}/subscription`}>
                    ✨ Nâng cấp Gói Hội Viên Pro <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Bottom Growth Card */}
      <Card className="border border-border/80 bg-gradient-to-br from-amber-500/5 via-primary/5 to-transparent shadow-xs">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-bold text-foreground">
                Đã hoàn tất danh mục dịch vụ? Mở bán bùng nổ cùng Gói Hội Viên Pro
              </h3>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              Mở khóa huy hiệu Tích xanh xác thực (Verified Partner), lên top đầu trang Khám phá, tự động được AI Trip Planner đề xuất vào lịch trình du khách đến địa phương và hưởng trọn 100% doanh thu (0% hoa hồng).
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600">
            <Link href="/partner/subscription">
              <Sparkles className="h-4 w-4" /> Khám phá các Gói Hội Viên
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
