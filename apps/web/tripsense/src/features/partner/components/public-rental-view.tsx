"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Car,
  Calendar,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { getPublicRental } from "../services/rental-api";
import { RentalReservationDialog } from "./rental-reservation-dialog";
import type { PublicRentalListingDto, RentalItemDto } from "../types";

interface PublicRentalViewProps {
  businessId: string;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export function PublicRentalView({ businessId }: PublicRentalViewProps) {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [data, setData] = React.useState<PublicRentalListingDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<RentalItemDto | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const isOwner = Boolean(currentUserId && data?.ownerUserId && currentUserId === data.ownerUserId);

  React.useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getPublicRental(businessId);
        if (active) setData(res);
      } catch (err: unknown) {
        if (active) {
          setError(
            getSafeErrorMessage(
              err,
              t("partner.rental.notFound", {
                defaultValue: "Không tìm thấy cơ sở cho thuê hoặc cơ sở chưa công khai.",
              }),
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [businessId, t]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-8 text-center text-destructive">
          <Store className="mx-auto h-12 w-12 mb-3 opacity-60" />
          <h2 className="text-lg font-bold mb-1">
            {t("partner.rental.unavailableTitle", { defaultValue: "Cơ sở cho thuê chưa sẵn sàng" })}
          </h2>
          <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">
            {error ||
              t("partner.rental.unavailableDesc", {
                defaultValue: "Cơ sở này có thể đang tạm ẩn hồ sơ hoặc chưa hoàn tất kích hoạt.",
              })}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/explore">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Quay lại khám phá
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const inquiryMessage = encodeURIComponent(
    `Xin chào ${data.displayName}, tôi muốn hỏi thuê xe/thiết bị. Bạn có thể tư vấn lịch trống giúp tôi được không?`,
  );
  const chatHref = data.ownerUserId ? `/chat?userId=${data.ownerUserId}&message=${inquiryMessage}` : null;

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
          <Link href="/explore">
            <ArrowLeft className="h-4 w-4" /> Khám phá địa điểm
          </Link>
        </Button>
        {isOwner && (
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link href={`/partner/businesses/${data.id}/rentals`}>Quản lý danh mục của tôi</Link>
          </Button>
        )}
      </div>

      {/* Hero Profile Header */}
      <Card className="overflow-hidden border-teal-500/30 bg-teal-500/5 shadow-xs rounded-2xl">
        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[11px]">
                <Car className="mr-1 h-3 w-3" /> Thuê xe & Dịch vụ trải nghiệm
              </Badge>
              {data.verifiedPartner && (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[11px]">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Verified Partner
                </Badge>
              )}
              {data.acceptingNew ? (
                <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 text-[11px]">
                  Đang mở nhận đặt
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 text-[11px]">
                  Tạm dừng nhận đặt online
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">{data.displayName}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {data.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-teal-600" /> {data.address}
                </span>
              )}
              {data.openingHours && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-teal-600" /> {data.openingHours}
                </span>
              )}
              {data.publicPhone && (
                <a href={`tel:${data.publicPhone}`} className="flex items-center gap-1 hover:underline text-foreground font-medium">
                  <Phone className="h-3.5 w-3.5 text-teal-600" /> {data.publicPhone}
                </a>
              )}
              {data.publicEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-teal-600" /> {data.publicEmail}
                </span>
              )}
            </div>
          </div>

          {!isOwner && chatHref && (
            <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 font-semibold border-teal-500/40 text-teal-700 dark:text-teal-300">
              <Link href={chatHref}>
                <MessageSquare className="h-4 w-4" /> Nhắn tin & Đặt qua Chat
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Items Catalog Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground">
          Danh mục phương tiện & thiết bị ({data.items.length})
        </h2>

        {data.items.length === 0 ? (
          <Card className="border-dashed p-10 text-center rounded-2xl">
            <Car className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">Chưa có phương tiện hoặc thiết bị nào được mở bán</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Đối tác hiện chưa cập nhật danh mục chi tiết. Bạn có thể liên hệ trực tiếp hoặc nhắn tin qua Chat để hỏi tình trạng xe trống.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((item) => (
              <Card key={item.id} className="overflow-hidden border-border/80 flex flex-col justify-between rounded-2xl">
                <div>
                  {item.thumbnailUrl ? (
                    <div className="aspect-[16/9] bg-muted overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-foreground">{item.name}</h3>
                        <p className="text-micro text-muted-foreground mt-0.5">
                          Kho: {item.totalInventory} khả dụng
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-bold text-teal-600 dark:text-teal-400">
                          {formatVnd(item.pricePerDay)}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">/ ngày</span>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground pt-1">
                      {item.depositAmount > 0 && (
                        <Badge variant="outline" className="text-[11px]">
                          Cọc: {formatVnd(item.depositAmount)}
                        </Badge>
                      )}
                      {item.deliveryAvailable && (
                        <Badge variant="outline" className="text-[11px] border-teal-500/30 text-teal-700 dark:text-teal-300">
                          Hỗ trợ giao tận nơi
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-border/40">
                  <Button
                    type="button"
                    disabled={!data.acceptingNew}
                    onClick={() => {
                      setSelectedItem(item);
                      setDialogOpen(true);
                    }}
                    className="w-full h-9 gap-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {data.acceptingNew ? "Đặt thuê ngay" : "Cơ sở tạm dừng nhận đơn"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <RentalReservationDialog
          rentalItem={selectedItem}
          ownerUserId={data.ownerUserId}
          businessName={data.displayName}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
