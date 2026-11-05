"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import { formatHotelTime } from "@/features/hotels/utils/hotel-time";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  BedDouble,
  Pencil,
  Sparkles,
  Phone,
  Eye,
} from "lucide-react";
import { PartnerWizardModal } from "@/features/partner/components/partner-wizard-modal";

export default function PartnerHotelPropertyPage() {
  const { t } = useTranslation();
  const { business, property, isOwner, refresh } = usePartnerHotel();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [profileEditorOpen, setProfileEditorOpen] = React.useState(false);

  const approvedProfile = (business?.draftProfile as Record<string, unknown>) ?? {};
  const destination = String(approvedProfile.destination ?? "Đà Nẵng");
  const address = String(approvedProfile.address ?? "");
  const phone = String(approvedProfile.phone ?? "");

  const handleQuickActivate = async () => {
    if (!business || !isOwner || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await hotelApi("/properties", "POST", {
        businessId: business.id,
        name: business.displayName,
        destination: destination || "Đà Nẵng",
        address: address || business.displayName,
        timeZone: "Asia/Ho_Chi_Minh",
        checkInTime: "14:00",
        checkOutTime: "11:00",
      });
      setSuccess("Đã kích hoạt trang Showcase cơ sở lưu trú thành công!");
      await refresh();
    } catch (e) {
      setError(getSafeErrorMessage(e, "Kích hoạt trang cơ sở thất bại"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {business?.requiresReverification && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("partner.profileUpdate.waitingReview")}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Feature Showcase Card */}
      <Card className="rounded-2xl border-border overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg font-bold text-foreground">
                  {property ? property.name : business?.displayName}
                </CardTitle>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                  {property ? "Đang mở đón khách" : "Sẵn sàng kích hoạt"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Mô hình: Giới thiệu Showcase hình ảnh & Đặt phòng trực tiếp qua Tin nhắn (0% hoa hồng)
              </CardDescription>
            </div>

            {isOwner && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProfileEditorOpen(true)}
                  className="gap-1.5 text-xs h-8"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Chỉnh sửa hồ sơ & Tải ảnh</span>
                </Button>
                <Button asChild size="sm" className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground font-semibold">
                  <Link href="/chat">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Hộp thư khách hàng</span>
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Địa chỉ & Điểm đến</span>
                <p className="font-medium text-foreground truncate">{property?.address || address || "Chưa cập nhật địa chỉ"}</p>
                <p className="text-xs text-muted-foreground">{property?.destination || destination || "Việt Nam"}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Giờ nhận / trả phòng tham khảo</span>
                <p className="font-medium text-foreground">
                  Check-in: {property ? formatHotelTime(property.check_in_time) : "14:00"} · Check-out: {property ? formatHotelTime(property.check_out_time) : "11:00"}
                </p>
                <p className="text-xs text-muted-foreground">Múi giờ: Asia/Ho_Chi_Minh</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
              <Phone className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5 min-w-0">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase block">Hotline tư vấn</span>
                <p className="font-medium text-foreground truncate">{phone || "Chưa có hotline"}</p>
                <p className="text-xs text-muted-foreground">Khách du lịch có thể gọi hoặc nhắn tin</p>
              </div>
            </div>
          </div>

          {/* Quick Activate if not yet created */}
          {!property && isOwner && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Kích hoạt trang Showcase trên TripSense</span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Đưa cơ sở lưu trú của bạn lên danh sách tìm kiếm để khách du lịch có thể xem ảnh và nhắn tin đặt phòng ngay hôm nay.
                </p>
              </div>
              <Button onClick={handleQuickActivate} disabled={busy} className="h-9 font-semibold text-xs shrink-0">
                {busy ? "Đang kích hoạt..." : "Kích hoạt Showcase ngay"}
              </Button>
            </div>
          )}

          {/* Chat Inquiries Promotion Banner */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h4 className="font-bold text-sm text-foreground">Quy trình đón khách qua Tin Nhắn Chat</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <span className="font-bold text-foreground block">1. Khách xem hình ảnh & giá</span>
                <p>Khách du lịch tìm kiếm khách sạn, ngắm bộ sưu tập ảnh và mức giá tham khảo của các loại phòng.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <span className="font-bold text-foreground block">2. Nhắn tin đặt phòng trực tiếp</span>
                <p>Khách bấm nút &quot;Nhắn tin đặt phòng&quot;. Yêu cầu và thông tin ngày giờ được gửi thẳng vào hộp thư chat của bạn.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/40 space-y-1">
                <span className="font-bold text-foreground block">3. Xác nhận & 0% Hoa hồng</span>
                <p>Bạn trao đổi trực tiếp, thỏa thuận đặt cọc hoặc chốt nhận khách mà không phải chia sẻ hoa hồng cho bên thứ ba.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild size="sm" variant="default" className="gap-1.5 text-xs h-8">
                <Link href="/chat">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Mở Hộp thư Tin nhắn khách hàng</span>
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                <Link href={`/partner/businesses/${business?.id}/hotel/rooms`}>
                  <BedDouble className="h-3.5 w-3.5" />
                  <span>Quản lý loại phòng & hình ảnh</span>
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {business && (
        <PartnerWizardModal
          open={profileEditorOpen}
          onOpenChange={setProfileEditorOpen}
          editBusiness={business}
          onSuccess={() => { void refresh(); }}
        />
      )}
    </div>
  );
}
