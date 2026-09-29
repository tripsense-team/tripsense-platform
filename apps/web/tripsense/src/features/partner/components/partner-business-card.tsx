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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { updateIntakeState, updatePublicationState } from "../services/partner-api";
import type { BusinessDetailDto } from "../types";

interface PartnerBusinessCardProps {
  business: BusinessDetailDto;
  onUpdated?: (updated: BusinessDetailDto) => void;
}

export function PartnerBusinessCard({ business, onUpdated }: PartnerBusinessCardProps) {
  const [loadingAction, setLoadingAction] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const getKindIcon = () => {
    switch (business.kind) {
      case "HOTEL":
        return <Building2 className="h-5 w-5 text-blue-500" />;
      case "RESTAURANT":
        return <Utensils className="h-5 w-5 text-amber-500" />;
      case "TOUR_GUIDE":
        return <Compass className="h-5 w-5 text-emerald-500" />;
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
      setActionError(err instanceof Error ? err.message : "Không thể thay đổi trạng thái công khai");
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
      setActionError(err instanceof Error ? err.message : "Không thể thay đổi tiếp nhận mới");
    } finally {
      setLoadingAction(false);
    }
  };

  const isApproved = business.approvalValidity === "VALID";
  const isSuspended = business.operationState === "SUSPENDED";
  const isPublished = business.publicationState === "PUBLISHED";

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
            ) : business.approvalValidity === "REVOKED" ? (
              <Badge variant="destructive" className="text-[11px]">
                Bị thu hồi
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[11px]">
                Chờ duyệt
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
            <span className="text-muted-foreground block text-[11px]">Tiếp nhận đặt chỗ:</span>
            <span className="font-medium text-foreground">
              {business.acceptingNew ? "Đang mở nhận" : "Tạm dừng nhận mới"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Quyền của bạn:</span>
            <span className="font-medium text-foreground">{business.myRole || "OWNER"}</span>
          </div>
        </div>

        {/* Operational Controls if Approved */}
        {isApproved && !business.requiresReverification && !isSuspended && (
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
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border/40 p-4 pt-3">
        <div className="flex w-full items-center gap-2">
          {business.kind === "TOUR_GUIDE" && (
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
          )}

          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-8 text-xs flex-1"
          >
            <Link href={`/partner/businesses/${business.id}/guide-inquiries`}>
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Nhu cầu tư vấn
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
