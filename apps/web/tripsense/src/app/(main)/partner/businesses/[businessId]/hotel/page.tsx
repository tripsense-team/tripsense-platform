"use client";

import * as React from "react";
import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import { getBusinessApplications } from "@/features/partner/services/partner-api";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { CheckCircle2, Clock, MapPin, RefreshCw, AlertTriangle } from "lucide-react";

export default function PartnerHotelPropertyPage() {
  const { t } = useTranslation();
  const { business, property, isOwner, refresh } = usePartnerHotel();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const approvedProfile = business?.draftProfile ?? {};
  const destination = String(approvedProfile.destination ?? "");
  const address = String(approvedProfile.address ?? "");

  const handleSyncApproved = async () => {
    if (!property || !business || !isOwner || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const apps = await getBusinessApplications(business.id);
      const revision = apps.find((a) => a.id === business.approvedRevisionId);
      const snapshot = revision?.profileSnapshot;
      if (!snapshot?.destination || !snapshot?.address) {
        throw new Error("Hồ sơ đã duyệt chưa có đầy đủ thông tin điểm đến và địa chỉ");
      }
      await hotelApi(`/properties/${property.id}`, "PUT", {
        businessId: business.id,
        name: business.displayName,
        destination: String(snapshot.destination),
        address: String(snapshot.address),
        timeZone: property.time_zone || "Asia/Ho_Chi_Minh",
        checkInTime: property.check_in_time || "14:00",
        checkOutTime: property.check_out_time || "11:00",
      });
      setSuccess(t("trip.hotels.syncSuccess", { defaultValue: "Đã đồng bộ thông tin khách sạn với hồ sơ đã duyệt!" }));
      await refresh();
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Đồng bộ thất bại" })));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateProperty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!business || !isOwner || busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await hotelApi("/properties", "POST", {
        businessId: business.id,
        name: business.displayName,
        destination: String(data.get("destination")),
        address: String(data.get("address")),
        timeZone: String(data.get("timeZone") || "Asia/Ho_Chi_Minh"),
        checkInTime: String(data.get("checkInTime") || "14:00"),
        checkOutTime: String(data.get("checkOutTime") || "11:00"),
      });
      setSuccess(t("trip.hotels.propertyCreatedSuccess", { defaultValue: "Đã đăng ký cơ sở lưu trú thành công!" }));
      await refresh();
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Đăng ký cơ sở thất bại" })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {property ? (
        /* Existing Property Card */
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold">{property.name}</CardTitle>
                <CardDescription className="text-xs">
                  ID: <span className="font-mono">{property.id}</span> · Trạng thái:{" "}
                  <span className="font-semibold text-foreground uppercase">{property.status}</span>
                </CardDescription>
              </div>

              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncApproved}
                  disabled={busy}
                  className="gap-1.5 text-xs self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                  <span>{t("trip.hotels.syncApproved", { defaultValue: "Đồng bộ từ hồ sơ duyệt" })}</span>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <span className="text-micro text-muted-foreground font-semibold uppercase block">Địa chỉ & Điểm đến</span>
                  <p className="font-medium text-foreground">{property.address || address}</p>
                  <p className="text-xs text-muted-foreground">{property.destination || destination}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/60">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <span className="text-micro text-muted-foreground font-semibold uppercase block">Chính sách nhận / trả phòng</span>
                  <p className="font-medium text-foreground">
                    Check-in: {property.check_in_time} · Check-out: {property.check_out_time}
                  </p>
                  <p className="text-xs text-muted-foreground">Múi giờ: {property.time_zone}</p>
                </div>
              </div>
            </div>

            {!isOwner && (
              <p className="text-xs text-muted-foreground italic">
                * Bạn đang đăng nhập với vai trò Quản lý (Manager). Chỉ Chủ cơ sở (Owner) mới có quyền chỉnh sửa hoặc đồng bộ thông tin cơ sở.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Create / Register Property Card */
        <Card className="rounded-2xl border-border">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              {t("trip.hotels.registerPropertyTitle", { defaultValue: "Khởi tạo cơ sở lưu trú" })}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("trip.hotels.registerPropertyDesc", { defaultValue: "Khai báo cơ sở lưu trú tương ứng với hồ sơ kinh doanh đã được duyệt." })}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isOwner ? (
              <form onSubmit={handleCreateProperty} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Tên cơ sở kinh doanh</label>
                  <Input value={business?.displayName || ""} disabled className="bg-muted/50" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Tỉnh / Thành phố điểm đến</label>
                  <Input name="destination" defaultValue={destination} required placeholder="Ví dụ: Đà Nẵng" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Múi giờ</label>
                  <Input name="timeZone" defaultValue="Asia/Ho_Chi_Minh" required />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground">Địa chỉ chi tiết</label>
                  <Input name="address" defaultValue={address} required placeholder="Số nhà, tên đường, quận/huyện" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Giờ nhận phòng (Check-in)</label>
                  <Input name="checkInTime" type="time" defaultValue="14:00" required />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Giờ trả phòng (Check-out)</label>
                  <Input name="checkOutTime" type="time" defaultValue="11:00" required />
                </div>

                <div className="sm:col-span-2 pt-2">
                  <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                    {busy ? "Đang xử lý..." : "Đăng ký cơ sở lưu trú"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Cơ sở này chưa được khởi tạo. Vui lòng liên hệ Chủ cơ sở (Owner) để hoàn tất đăng ký ban đầu.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
