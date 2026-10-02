"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { PartnerHotelProvider, usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  BedDouble,
  CalendarDays,
  Users,
  DollarSign,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "@/i18n";

export default function PartnerHotelLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ businessId: string }>();
  return (
    <PartnerHotelProvider businessId={params.businessId}>
      <PartnerHotelLayoutInner businessId={params.businessId}>
        {children}
      </PartnerHotelLayoutInner>
    </PartnerHotelProvider>
  );
}

function PartnerHotelLayoutInner({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { business, myRole, isManager, loading, error, refresh } = usePartnerHotel();

  const baseUrl = `/partner/businesses/${businessId}/hotel`;

  const navItems = [
    { href: baseUrl, label: t("trip.hotels.tabProperty", { defaultValue: "Thông tin cơ sở" }), icon: Building2, exact: true },
    { href: `${baseUrl}/rooms`, label: t("trip.hotels.tabRooms", { defaultValue: "Loại phòng" }), icon: BedDouble },
    { href: `${baseUrl}/inventory`, label: t("trip.hotels.tabInventory", { defaultValue: "Lịch phòng & Giá" }), icon: CalendarDays },
    { href: `${baseUrl}/bookings`, label: t("trip.hotels.tabBookings", { defaultValue: "Đơn đặt phòng" }), icon: Users },
    { href: `${baseUrl}/commerce`, label: t("trip.hotels.tabCommerce", { defaultValue: "Đối soát doanh thu" }), icon: DollarSign },
  ];

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="h-24 animate-pulse rounded-2xl bg-muted/40 border border-border" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted/30 border border-border" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {error || t("trip.hotels.businessNotFound", { defaultValue: "Không tìm thấy cơ sở kinh doanh" })}
        </h2>
        <Button asChild variant="outline">
          <Link href="/partner">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            <span>{t("trip.hotels.backToPartnerHub", { defaultValue: "Quay lại Trung tâm Đối tác" })}</span>
          </Link>
        </Button>
      </div>
    );
  }

  if (business.kind !== "HOTEL") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {t("trip.hotels.notHotelKind", { defaultValue: "Cơ sở này không thuộc danh mục khách sạn / lưu trú" })}
        </h2>
        <Button asChild variant="outline">
          <Link href="/partner">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            <span>{t("trip.hotels.backToPartnerHub", { defaultValue: "Quay lại Trung tâm Đối tác" })}</span>
          </Link>
        </Button>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {t("trip.hotels.accessDenied", { defaultValue: "Bạn không có quyền quản lý cơ sở này" })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("trip.hotels.requireOwnerOrManager", { defaultValue: "Chỉ chủ cơ sở (Owner) hoặc người quản lý (Manager) mới có quyền truy cập." })}
        </p>
        <Button asChild variant="outline">
          <Link href="/partner">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            <span>{t("trip.hotels.backToPartnerHub", { defaultValue: "Quay lại Trung tâm Đối tác" })}</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-muted/60 border border-border p-4 md:p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 border border-primary/20">
              <Building2 className="h-3 w-3" />
              <span>{t("trip.hotels.partnerBadge", { defaultValue: "Kênh Đối tác khách sạn" })}</span>
            </span>
            <Badge variant="outline" className="text-micro font-mono">
              Vai trò: {myRole}
            </Badge>
            {business.approvalValidity === "VALID" ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro">
                Đã duyệt
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-micro">
                Chờ duyệt
              </Badge>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {business.displayName}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refresh()} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t("common.refresh", { defaultValue: "Làm mới" })}</span>
          </Button>
          <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs">
            <Link href="/partner">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.backToPartnerHub", { defaultValue: "Trung tâm Đối tác" })}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <nav className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                isActive
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Subpage Content */}
      <main>{children}</main>
    </div>
  );
}
