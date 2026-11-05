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
  ChevronRight,
  ShieldAlert,
  BedDouble,
  BookOpen,
  DollarSign,
  ExternalLink,
  Pencil,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle,
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
  onUpdated?: (updated: BusinessDetailDto) => void;
  onProfileUpdateSubmitted?: () => void;
  onSelectBookings?: (businessId: string) => void;
}

export function PartnerBusinessCard({
  business,
  onUpdated,
  onProfileUpdateSubmitted,
  onSelectBookings,
}: PartnerBusinessCardProps) {
  const { t } = useTranslation();
  const [loadingAction, setLoadingAction] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [profileEditorOpen, setProfileEditorOpen] = React.useState(false);

  const getKindIcon = () => {
    switch (business.kind) {
      case "HOTEL":
        return <Building2 className="h-5 w-5 text-blue-500" />;
      case "RESTAURANT":
        return <Utensils className="h-5 w-5 text-amber-500" />;
      case "TOUR_GUIDE":
        return <Compass className="h-5 w-5 text-emerald-500" />;
      case "RENTAL_SERVICE":
        return <Car className="h-5 w-5 text-teal-500" />;
      default:
        return <Building2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getKindLabel = () => {
    switch (business.kind) {
      case "HOTEL":
        return "Khách sạn / Lưu trú";
      case "RESTAURANT":
        return "Quán ăn / Nhà hàng";
      case "TOUR_GUIDE":
        return "Hướng dẫn viên du lịch";
      case "RENTAL_SERVICE":
        return "Dịch vụ cho thuê";
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
        setActionError("Cơ sở đang cần xác minh lại hồ sơ trước khi công khai");
      } else {
        setActionError(getSafeErrorMessage(err, "Không thể thay đổi trạng thái công khai"));
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
      const rawData = typeof err === "object" && err !== null && "data" in err ? (err as { data?: unknown }).data : null;
      const errorCode = typeof rawData === "object" && rawData !== null && "code" in rawData ? String((rawData as { code?: unknown }).code) : "";
      const rawDetail = typeof rawData === "object" && rawData !== null && "message" in rawData ? String((rawData as { message?: unknown }).message) : "";
      if (
        msg.includes("READINESS_INCOMPLETE") ||
        msg.toLowerCase().includes("not eligible") ||
        errorCode === "READINESS_INCOMPLETE" ||
        rawDetail.toLowerCase().includes("not eligible")
      ) {
        setActionError("Cơ sở chưa đủ điều kiện mở đón khách (Cần được cấp quyền nhận khách và hoàn tất cấu hình phòng/thực đơn)");
      } else if (msg.includes("REVERIFICATION_REQUIRED") || msg.includes("reverification")) {
        setActionError("Cơ sở đang cần xác minh lại hồ sơ trước khi mở đón khách");
      } else {
        setActionError(getSafeErrorMessage(err, "Không thể thay đổi trạng thái đón tiếp"));
      }
    } finally {
      setLoadingAction(false);
    }
  };

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
      : `/partner/businesses/${business.id}/guide-promotions`;

  const serviceStepName =
    business.kind === "RESTAURANT"
      ? "2. Thực đơn & Bảng giá"
      : business.kind === "HOTEL"
      ? "2. Quản lý phòng & cơ sở"
      : "2. Soạn bài quảng bá tour";

  const previewLink =
    business.kind === "RESTAURANT"
      ? `/restaurants/${business.id}`
      : business.kind === "HOTEL"
      ? `/hotels/${business.id}`
      : `/guides/${business.id}`;

  return (
    <Card className="flex flex-col overflow-hidden border-border/80 transition-all hover:border-primary/40 hover:shadow-md">
      {/* Reverification Alert Banner (§7) */}
      {business.requiresReverification && (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Cơ sở đang tạm khóa do có thay đổi quan trọng, chờ Admin xét duyệt lại</span>
        </div>
      )}

      {/* Suspended Alert Banner */}
      {isSuspended && !business.requiresReverification && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Cơ sở đang bị tạm đình chỉ vận hành bởi Ban quản trị</span>
        </div>
      )}

      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
              {getKindIcon()}
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base tracking-tight line-clamp-1">
                {business.displayName}
              </h3>
              <p className="text-xs text-muted-foreground">{getKindLabel()}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            {isApproved ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px]">
                <UserCheck className="mr-1 h-3 w-3" /> Đã duyệt
              </Badge>
            ) : isSuspended || business.approvalValidity === "REVOKED" ? (
              <Badge variant="destructive" className="text-[11px]">
                Bị tạm khóa
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px]">
                <Clock className="mr-1 h-3 w-3" /> Đang chờ duyệt
              </Badge>
            )}

            {isApproved && (
              <Badge
                variant="outline"
                className={`text-micro ${
                  isPublished
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                {isPublished ? "Đang công khai" : "Đã tạm ẩn"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-5 py-2">
        {actionError && (
          <div className="mb-3 rounded bg-destructive/10 p-2 text-xs text-destructive">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/30 p-2.5 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Đón tiếp khách:</span>
            <span className="font-medium text-foreground">
              {business.acceptingNew ? "Đang mở đón khách" : "Tạm dừng đón khách"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Quyền quản trị:</span>
            <span className="font-medium text-foreground">{business.myRole || "OWNER"}</span>
          </div>
        </div>

        {/* Hướng dẫn hoàn thiện cơ sở - Trực quan, dễ hiểu & bấm trực tiếp */}
        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Các bước để cơ sở đón khách:
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Bước 2 / 4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {/* Bước 1 */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-background border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white text-micro font-bold">✓</span>
              <span>1. Tạo hồ sơ cơ sở</span>
            </div>

            {/* Bước 2 */}
            <Link
              href={serviceLink}
              className="flex items-center justify-between p-2 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-medium hover:bg-amber-500/25 transition-all shadow-2xs group"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white text-micro font-bold">2</span>
                <span className="truncate">{serviceStepName}</span>
              </div>
              <ArrowRight className="h-3 w-3 shrink-0 ml-1 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            {/* Bước 3 */}
            <Link
              href={previewLink}
              target="_blank"
              className="flex items-center justify-between p-2 rounded-md bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-micro font-bold">3</span>
                <span className="truncate">3. Xem trang đón khách</span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 ml-1 text-muted-foreground" />
            </Link>

            {/* Bước 4 */}
            <Link
              href={`/partner/businesses/${business.id}/subscription`}
              className="flex items-center justify-between p-2 rounded-md bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-amber-500/40 transition-all"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-micro font-bold">4</span>
                <span className="truncate">4. Gói Pro (Ưu tiên AI)</span>
              </div>
              <Sparkles className="h-3 w-3 shrink-0 ml-1 text-amber-500" />
            </Link>
          </div>

          {business.kind === "RESTAURANT" && (
            <p className="text-micro text-muted-foreground pt-1 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
              <span>Chỉ cần up ảnh và thay ảnh thực đơn trực tiếp rất đơn giản, không cần nhập từng món lẻ.</span>
            </p>
          )}
        </div>

        {/* Operational Controls if Approved & Owner */}
        {canManageControls && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePublication}
              disabled={loadingAction}
              className="h-8 text-xs flex-1"
            >
              {isPublished ? (
                <>
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Tạm ẩn hồ sơ
                </>
              ) : (
                <>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Bật công khai
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleIntake}
              disabled={loadingAction}
              className="h-8 text-xs flex-1"
            >
              {business.acceptingNew ? (
                <>
                  <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Tạm dừng nhận
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Mở nhận khách
                </>
              )}
            </Button>
          </div>
        )}

        {isApproved && !isOwner && (
          <div className="mt-2 text-center text-[11px] text-muted-foreground italic">
            (Chỉ Owner mới có quyền thay đổi trạng thái công khai và tiếp nhận)
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border/40 p-4 pt-3">
        {isOwner && isApproved && (!business.requiresReverification || business.latestApplicationState !== "SUBMITTED") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs font-medium"
            onClick={() => setProfileEditorOpen(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5 text-primary" />
            {business.requiresReverification
              ? t("partner.profileUpdate.resume", { defaultValue: "Hoàn tất gửi xét duyệt" })
              : t("partner.profileUpdate.edit", { defaultValue: "Cập nhật hồ sơ" })}
          </Button>
        )}
        <div className="flex w-full items-center gap-2">
          {business.kind === "RENTAL_SERVICE" && (
            <>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="h-8 text-xs flex-1"
              >
                <Link href={`/partner/businesses/${business.id}/rentals`}>
                  <Car className="mr-1.5 h-3.5 w-3.5 text-teal-600" /> Quản lý danh mục
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/5 font-medium"
                onClick={() => onSelectBookings?.(business.id)}
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5" /> Đơn đặt thuê
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
              >
                <Link href={`/partner/businesses/${business.id}/subscription`}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gói Hội Viên
                </Link>
              </Button>
            </>
          )}

          {business.kind === "TOUR_GUIDE" && (
            <>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="h-8 text-xs flex-1"
              >
                <Link href={`/partner/businesses/${business.id}/guide-promotions`}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Bài quảng bá
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
              >
                <Link href={`/partner/businesses/${business.id}/subscription`}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gói Hội Viên
                </Link>
              </Button>
            </>
          )}

          {business.kind === "HOTEL" && (
            <>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="h-8 text-xs flex-1"
              >
                <Link href={`/partner/businesses/${business.id}/hotel`}>
                  <BedDouble className="mr-1.5 h-3.5 w-3.5" /> Quản lý phòng
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-primary/30 text-primary hover:bg-primary/5 font-medium"
                onClick={() => onSelectBookings?.(business.id)}
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5" /> Đơn đặt phòng
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
              >
                <Link href={`/partner/businesses/${business.id}/subscription`}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gói Hội Viên
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2"
                title="Xem trước trang du khách"
              >
                <Link href={`/hotels/${business.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}

          {business.kind === "RESTAURANT" && (
            <>
              <Button
                asChild
                variant="secondary"
                size="sm"
                className="h-8 text-xs flex-1"
              >
                <Link href={`/partner/businesses/${business.id}/restaurant-menu`}>
                  <Utensils className="mr-1.5 h-3.5 w-3.5" /> Thực đơn & Bảng giá
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-primary/30 text-primary hover:bg-primary/5 font-medium"
              >
                <Link href={`/partner/businesses/${business.id}/restaurant-menu?tab=reservations`}>
                  <Calendar className="mr-1.5 h-3.5 w-3.5" /> Yêu cầu đặt bàn
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1"
              >
                <Link href="/chat">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat với khách
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
              >
                <Link href={`/partner/businesses/${business.id}/subscription`}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Gói Pro
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs px-2"
                title="Xem trước trang du khách"
              >
                <Link href={`/restaurants/${business.id}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
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
