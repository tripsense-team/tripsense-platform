"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Utensils,
  Compass,
  AlertTriangle,
  Eye,
  EyeOff,
  UserCheck,
  PauseCircle,
  PlayCircle,
  FileText,
  MessageSquare,
  ShieldAlert,
  BedDouble,
  ExternalLink,
  Pencil,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  Car,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { updateIntakeState, updatePublicationState } from "../services/partner-api";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { PartnerWizardModal } from "./partner-wizard-modal";
import { useTranslation } from "@/i18n";
import type { BusinessDetailDto } from "../types";

interface PartnerBusinessCardProps {
  business: BusinessDetailDto;
  pendingBookingsCount?: number;
  onUpdated?: (updated: BusinessDetailDto) => void;
  onProfileUpdateSubmitted?: () => void;
  onSelectBookings?: (businessId: string) => void;
}

export function PartnerBusinessCard({
  business,
  pendingBookingsCount = 0,
  onUpdated,
  onProfileUpdateSubmitted,
  onSelectBookings,
}: PartnerBusinessCardProps) {
  const { t } = useTranslation();
  const [loadingAction, setLoadingAction] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = React.useState(false);

  const getKindVisual = () => {
    switch (business.kind) {
      case "HOTEL":
        return {
          icon: <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
          bg: "bg-blue-500/10 border-blue-500/20",
          label: "Khách sạn / Lưu trú",
        };
      case "RESTAURANT":
        return {
          icon: <Utensils className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
          bg: "bg-amber-500/10 border-amber-500/20",
          label: "Quán ăn / Nhà hàng",
        };
      case "TOUR_GUIDE":
        return {
          icon: <Compass className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
          bg: "bg-emerald-500/10 border-emerald-500/20",
          label: "Hướng dẫn viên du lịch",
        };
      case "RENTAL_SERVICE":
        return {
          icon: <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />,
          bg: "bg-teal-500/10 border-teal-500/20",
          label: "Dịch vụ cho thuê",
        };
      default:
        return {
          icon: <Building2 className="h-5 w-5 text-muted-foreground" />,
          bg: "bg-muted/50 border-border/60",
          label: "Cơ sở đối tác",
        };
    }
  };

  const handleTogglePublication = async () => {
    try {
      setLoadingAction(true);
      setActionError(null);
      const nextState = business.publicationState === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
      const updated = await updatePublicationState(business.id, {
        expectedVersion: business.version,
        state: nextState,
      });
      onUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("REVERIFICATION_REQUIRED") || msg.includes("reverification")) {
        setActionError("Cơ sở đang cần xác minh lại hồ sơ trước khi công khai.");
      } else {
        setActionError(getSafeErrorMessage(err, "Không thể thay đổi trạng thái công khai."));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const handleToggleIntake = async () => {
    try {
      setLoadingAction(true);
      setActionError(null);
      const nextState = !business.acceptingNew;
      const updated = await updateIntakeState(business.id, {
        expectedVersion: business.version,
        acceptingNew: nextState,
      });
      onUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const rawData =
        typeof err === "object" && err !== null && "data" in err
          ? (err as { data?: unknown }).data
          : null;
      const errorCode =
        typeof rawData === "object" && rawData !== null && "code" in rawData
          ? String((rawData as { code?: unknown }).code)
          : "";
      const rawDetail =
        typeof rawData === "object" && rawData !== null && "message" in rawData
          ? String((rawData as { message?: unknown }).message)
          : "";
      if (
        msg.includes("HOTEL_ROOMS_REQUIRED") ||
        errorCode === "HOTEL_ROOMS_REQUIRED" ||
        msg.includes("hạng phòng") ||
        rawDetail.includes("hạng phòng")
      ) {
        setActionError("Khách sạn cần tạo ít nhất một hạng phòng trước khi mở đón khách.");
      } else if (
        msg.includes("RENTAL_ITEMS_REQUIRED") ||
        errorCode === "RENTAL_ITEMS_REQUIRED" ||
        msg.includes("phương tiện") ||
        rawDetail.includes("phương tiện")
      ) {
        setActionError(
          "Cơ sở cho thuê cần tạo ít nhất một phương tiện hoặc dịch vụ đang hoạt động trước khi mở đón khách.",
        );
      } else if (
        msg.includes("READINESS_INCOMPLETE") ||
        msg.toLowerCase().includes("not eligible") ||
        errorCode === "READINESS_INCOMPLETE" ||
        rawDetail.toLowerCase().includes("not eligible")
      ) {
        setActionError(
          "Cơ sở chưa đủ điều kiện mở đón khách (Hãy bật công khai hồ sơ trước và hoàn tất danh mục dịch vụ).",
        );
      } else if (msg.includes("REVERIFICATION_REQUIRED") || msg.includes("reverification")) {
        setActionError("Cơ sở đang cần xác minh lại hồ sơ trước khi mở đón khách.");
      } else {
        setActionError(getSafeErrorMessage(err, "Không thể thay đổi trạng thái đón tiếp."));
      }
    } finally {
      setLoadingAction(false);
    }
  };

  const kindVisual = getKindVisual();
  const isApproved = business.approvalValidity === "VALID";
  const isSuspended = business.operationState === "SUSPENDED";
  const isPublished = business.publicationState === "PUBLISHED";
  const isOwner = business.myRole === "OWNER";
  const canManageControls = isApproved && !business.requiresReverification && !isSuspended && isOwner;

  const serviceLink =
    business.kind === "RESTAURANT"
      ? `/partner/businesses/${business.id}/restaurant-menu`
      : business.kind === "HOTEL"
      ? `/partner/businesses/${business.id}/hotel`
      : business.kind === "RENTAL_SERVICE"
      ? `/partner/businesses/${business.id}/rentals`
      : `/partner/businesses/${business.id}/guide-promotions`;

  const serviceShortLabel =
    business.kind === "RESTAURANT"
      ? "Thực đơn & Giá"
      : business.kind === "HOTEL"
      ? "Quản lý phòng"
      : business.kind === "RENTAL_SERVICE"
      ? "Danh mục xe"
      : "Bài quảng bá";

  const bookingButtonLabel =
    business.kind === "RESTAURANT"
      ? "Yêu cầu đặt bàn"
      : business.kind === "HOTEL"
      ? "Đơn đặt phòng"
      : business.kind === "RENTAL_SERVICE"
      ? "Đơn đặt thuê"
      : "Yêu cầu tư vấn";

  const bookingsHref =
    business.kind === "TOUR_GUIDE"
      ? `/partner/businesses/${business.id}/guide-inquiries`
      : `/partner/bookings?businessId=${business.id}`;

  const previewLink =
    business.kind === "RESTAURANT"
      ? `/restaurants/${business.id}`
      : business.kind === "HOTEL"
      ? `/hotels/${business.id}`
      : business.kind === "RENTAL_SERVICE"
      ? `/rentals/${business.id}`
      : `/guides/${business.id}`;

  const ServiceIcon =
    business.kind === "RESTAURANT"
      ? Utensils
      : business.kind === "HOTEL"
      ? BedDouble
      : business.kind === "RENTAL_SERVICE"
      ? Car
      : FileText;

  return (
    <Card className="flex flex-col rounded-2xl border-border/75 bg-card shadow-2xs transition-colors hover:border-border">
      {/* Alert Banners */}
      {business.requiresReverification && (
        <div className="flex items-center gap-2 rounded-t-2xl border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Hồ sơ có thay đổi quan trọng, đang chờ Admin xét duyệt lại</span>
        </div>
      )}

      {isSuspended && !business.requiresReverification && (
        <div className="flex items-center gap-2 rounded-t-2xl border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>Cơ sở đang bị tạm đình chỉ vận hành</span>
        </div>
      )}

      {/* Card Header — fixed min-w-0 & whitespace-nowrap so badges never squish into circles */}
      <CardHeader className="p-5 pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${kindVisual.bg}`}
            >
              {kindVisual.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-foreground text-[15px] leading-snug truncate"
                title={business.displayName}
              >
                {business.displayName}
              </h3>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{kindVisual.label}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {isApproved ? (
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium whitespace-nowrap shrink-0"
              >
                <UserCheck className="mr-1 h-3 w-3 shrink-0" />
                Đã duyệt
              </Badge>
            ) : isSuspended || business.approvalValidity === "REVOKED" ? (
              <Badge variant="destructive" className="text-[11px] whitespace-nowrap shrink-0">
                Bị tạm khóa
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-medium whitespace-nowrap shrink-0"
              >
                <Clock className="mr-1 h-3 w-3 shrink-0" />
                Chờ duyệt
              </Badge>
            )}

            {isApproved && (
              <Badge
                variant="outline"
                className={`text-micro font-medium whitespace-nowrap shrink-0 ${
                  isPublished
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isPublished ? "Đang công khai" : "Đang tạm ẩn"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-5 py-2 space-y-3.5">
        {actionError && (
          <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive flex flex-col gap-1.5 border border-destructive/20">
            <span className="font-medium leading-relaxed">{actionError}</span>
            {business.kind === "HOTEL" &&
              (actionError.includes("hạng phòng") || actionError.includes("điều kiện")) && (
                <Link
                  href={serviceLink}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  <span>Thiết lập hạng phòng ngay</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            {business.kind === "RENTAL_SERVICE" &&
              (actionError.includes("phương tiện") ||
                actionError.includes("dịch vụ") ||
                actionError.includes("điều kiện")) && (
                <Link
                  href={serviceLink}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  <span>Tạo phương tiện hoặc dịch vụ cho thuê ngay</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
          </div>
        )}

        {/* Operational Snapshot */}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/25 px-3.5 py-2.5 text-xs">
          <div className="min-w-0">
            <span className="text-muted-foreground block text-[11px]">Đón tiếp khách</span>
            <span className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  business.acceptingNew ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <span className="truncate">
                {business.acceptingNew ? "Đang mở nhận" : "Tạm dừng nhận"}
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <span className="text-muted-foreground block text-[11px]">Quyền quản trị</span>
            <span className="mt-0.5 block font-semibold text-foreground truncate">
              {business.myRole || "OWNER"}
            </span>
          </div>
        </div>

        {/* Clean Onboarding / Readiness Checklist (no awkward truncated buttons) */}
        {!business.acceptingNew && (
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Điều kiện mở đón khách
              </span>
              <span className="text-[11px] text-muted-foreground">
                {isPublished ? "Đã công khai" : "Cần cấu hình"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5 text-[11px]">
              <Link
                href={serviceLink}
                className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-500/15 transition-colors"
              >
                <span className="truncate">Bước tiếp: Cấu hình {serviceShortLabel.toLowerCase()}</span>
                <ArrowRight className="h-3 w-3 shrink-0 ml-2" />
              </Link>
            </div>
          </div>
        )}

        {/* Owner Quick State Toggles */}
        {canManageControls && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePublication}
              disabled={loadingAction}
              className="h-8 text-xs font-medium justify-center"
            >
              {isPublished ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">Tạm ẩn hồ sơ</span>
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="truncate">Bật công khai</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleIntake}
              disabled={loadingAction}
              className="h-8 text-xs font-medium justify-center"
            >
              {business.acceptingNew ? (
                <>
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="truncate">Tạm dừng nhận</span>
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate">Mở nhận khách</span>
                </>
              )}
            </Button>
          </div>
        )}

        {isApproved && !isOwner && (
          <p className="text-center text-[11px] text-muted-foreground italic">
            Chỉ Owner mới có quyền bật/tắt trạng thái công khai và nhận khách.
          </p>
        )}
      </CardContent>

      {/* Structured 2-Row Footer — ZERO clipping or horizontal overflow */}
      <CardFooter className="flex flex-col gap-2.5 border-t border-border/50 bg-muted/10 p-4 pt-3.5">
        {/* Primary Row: Service Management & Dedicated Bookings */}
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button asChild variant="secondary" size="sm" className="h-9 text-xs font-medium px-2.5 min-w-0">
            <Link href={serviceLink} className="justify-center">
              <ServiceIcon className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{serviceShortLabel}</span>
            </Link>
          </Button>

          {onSelectBookings && business.kind !== "TOUR_GUIDE" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectBookings(business.id)}
              className="h-9 text-xs font-medium px-2.5 border-border/80 justify-center gap-1.5 min-w-0"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">{bookingButtonLabel}</span>
              {pendingBookingsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-rose-500 text-white text-micro font-bold leading-none shrink-0">
                  {pendingBookingsCount > 99 ? "99+" : pendingBookingsCount}
                </span>
              )}
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 text-xs font-medium px-2.5 border-border/80 min-w-0"
            >
              <Link href={bookingsHref} className="justify-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{bookingButtonLabel}</span>
                {pendingBookingsCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-rose-500 text-white text-micro font-bold leading-none shrink-0">
                    {pendingBookingsCount > 99 ? "99+" : pendingBookingsCount}
                  </span>
                )}
              </Link>
            </Button>
          )}
        </div>

        {/* Utility Row: Edit Profile, Pro Membership, Chat (if restaurant), Preview */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 w-full pt-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isOwner &&
              isApproved &&
              (!business.requiresReverification || business.latestApplicationState !== "SUBMITTED") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  {business.requiresReverification
                    ? t("partner.profileUpdate.resume", { defaultValue: "Hoàn tất duyệt" })
                    : t("partner.profileUpdate.edit", { defaultValue: "Cập nhật hồ sơ" })}
                </Button>
              )}

            {business.kind === "RESTAURANT" && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                <Link href="/chat">
                  <MessageSquare className="mr-1 h-3 w-3" />
                  Chat với khách
                </Link>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Link href={`/partner/businesses/${business.id}/subscription`}>
                <Sparkles className="mr-1 h-3 w-3" />
                Gói Pro
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              title="Xem trước trang du khách"
            >
              <Link href={previewLink} target="_blank">
                <ExternalLink className="mr-1 h-3 w-3" />
                Xem trang
              </Link>
            </Button>
          </div>
        </div>
      </CardFooter>

      <PartnerWizardModal
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
        editBusiness={business}
        onSuccess={() => onProfileUpdateSubmitted?.()}
      />
    </Card>
  );
}
