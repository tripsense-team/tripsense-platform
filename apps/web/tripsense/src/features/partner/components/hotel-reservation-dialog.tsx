"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Building2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ShieldCheck,
  MessageSquare,
  Users,
  BedDouble,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { chatApi } from "@/features/chat/services/chat-api";
import { notifyBookingActivityChanged } from "@/features/reservations/services/reservations-activity-api";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { createDirectHold } from "@/features/hotels/services/hotel-service-adapter";
import { getPublicHotelRooms } from "../services/partner-api";
import type { PublicHotelListingDto, PublicHotelRoomDto } from "../types";
import type { HotelBooking } from "@/features/hotels/types";

export interface HotelReservationDialogProps {
  hotel: PublicHotelListingDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (booking: HotelBooking) => void;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  defaultQuantity?: number;
}

function formatPrice(amount: number, currency: string = "VND"): string {
  if (currency === "VND") {
    return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
  }
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("vi-VN")} ${currency}`;
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HotelReservationDialog({
  hotel,
  open,
  onOpenChange,
  onSuccess,
  defaultCheckIn,
  defaultCheckOut,
  defaultGuests = 2,
  defaultQuantity = 1,
}: HotelReservationDialogProps) {
  const user = useAuthStore((state) => state.user);

  // Dates initialization (default tomorrow -> day after tomorrow)
  const defaultDates = React.useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return {
      checkIn: defaultCheckIn || toIsoDate(tomorrow),
      checkOut: defaultCheckOut || toIsoDate(dayAfter),
    };
  }, [defaultCheckIn, defaultCheckOut]);

  const [checkIn, setCheckIn] = React.useState(defaultDates.checkIn);
  const [checkOut, setCheckOut] = React.useState(defaultDates.checkOut);
  const [adults, setAdults] = React.useState(Math.max(1, defaultGuests));
  const [children, setChildren] = React.useState(0);
  const [quantity, setQuantity] = React.useState(defaultQuantity);

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [specialRequests, setSpecialRequests] = React.useState("");

  const [rooms, setRooms] = React.useState<PublicHotelRoomDto[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>("");
  const [loadingRooms, setLoadingRooms] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = React.useState<HotelBooking | null>(null);

  // Auto pre-fill user credentials
  React.useEffect(() => {
    if (open && user) {
      if (!customerName) {
        setCustomerName(user.name || (user.email ? user.email.split("@")[0] : ""));
      }
      if (!customerEmail && user.email) {
        setCustomerEmail(user.email);
      }
    }
  }, [open, user, customerName, customerEmail]);

  // Reset and load available rooms when opened
  React.useEffect(() => {
    if (!open) return;

    setCreatedBooking(null);
    setError(null);
    setLoadingRooms(true);

    getPublicHotelRooms(hotel.id)
      .then((roomList) => {
        setRooms(roomList);
        if (roomList.length > 0) {
          setSelectedRoomId(roomList[0].id);
        } else {
          setSelectedRoomId("");
        }
      })
      .catch((err) => {
        setError(getSafeErrorMessage(err, "Không thể tải danh sách loại phòng của khách sạn."));
      })
      .finally(() => {
        setLoadingRooms(false);
      });
  }, [open, hotel.id]);

  const selectedRoom = React.useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || rooms[0] || null;
  }, [rooms, selectedRoomId]);

  // Calculate nights
  const nights = React.useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [checkIn, checkOut]);

  // Total calculation
  const nightlyRate = selectedRoom?.pricePerNight ?? hotel.minPricePerNight ?? 0;
  const totalPrice = nightlyRate * nights * quantity;

  const handleResetAndClose = () => {
    setCreatedBooking(null);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!selectedRoom) {
      setError("Khách sạn hiện chưa có loại phòng sẵn sàng đặt trực tiếp.");
      return;
    }

    if (!checkIn || !checkOut) {
      setError("Vui lòng chọn ngày nhận phòng và ngày trả phòng hợp lệ.");
      return;
    }

    if (new Date(checkOut).getTime() <= new Date(checkIn).getTime()) {
      setError("Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim()) {
      setError("Vui lòng điền họ tên và số điện thoại người nhận phòng.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const criteria = {
        roomTypeId: selectedRoom.id,
        checkIn,
        checkOut,
        guests: adults + children,
        quantity,
      };

      const freshKey = crypto.randomUUID();
      const booking = await createDirectHold(criteria, freshKey);

      setCreatedBooking(booking);
      notifyBookingActivityChanged();

      if (onSuccess) {
        onSuccess(booking);
      }

      // Optionally notify hotel partner in Chat if partner is connected
      if (hotel.ownerUserId) {
        try {
          const bookingCode = booking.id ? booking.id.slice(0, 8).toUpperCase() : "TS";
          const currency = booking.currency || selectedRoom?.currency || "VND";
          const confirmedTotal = typeof booking.total === "number" ? booking.total : totalPrice;
          const chatMsg = `[Yêu cầu đặt phòng trực tiếp] Khách ${customerName} (SĐT: ${customerPhone}) đã gửi yêu cầu đặt ${quantity}x "${selectedRoom.name}" tại ${hotel.displayName} (${checkIn} → ${checkOut}, ${nights} đêm). Dự kiến: ${formatPrice(confirmedTotal, currency)}. Mã đơn: #TS-HTL-${bookingCode} (Chờ khách sạn xác nhận).`;
          void chatApi.sendDirectMessage(hotel.ownerUserId, chatMsg).catch(() => undefined);
        } catch {
          // Non-blocking notification
        }
      }
    } catch (err: unknown) {
      setError(
        getSafeErrorMessage(
          err,
          "Không thể hoàn tất đặt phòng. Vui lòng kiểm tra lại phòng trống hoặc liên hệ khách sạn.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto sm:rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {createdBooking ? "Đã gửi yêu cầu đặt phòng" : "Đặt phòng trực tiếp"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {hotel.displayName} {hotel.address ? `· ${hotel.address}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {createdBooking ? (
          <div className="space-y-5 py-3">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                <Clock className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Đã gửi yêu cầu đặt phòng!</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Phòng đang được giữ tạm thời để khách sạn xem xét và xác nhận. Bạn sẽ nhận thông báo ngay khi khách sạn xác nhận đơn.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <span className="text-muted-foreground font-medium">Mã đặt phòng:</span>
                <span className="font-mono font-bold text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-md text-micro">
                  #TS-HTL-{createdBooking.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khách sạn:</span>
                <span className="font-semibold text-foreground text-right">{hotel.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại phòng:</span>
                <span className="font-medium text-foreground">
                  {quantity}x {selectedRoom?.name || "Phòng nghỉ"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời gian lưu trú:</span>
                <span className="font-medium text-foreground">
                  {checkIn} → {checkOut} ({nights} đêm)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Khách lưu trú:</span>
                <span className="font-medium text-foreground">
                  {adults} Người lớn{children > 0 ? `, ${children} Trẻ em` : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Người đặt:</span>
                <span className="font-medium text-foreground">
                  {customerName} ({customerPhone})
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-sm">
                <span className="font-semibold text-foreground">Tổng chi phí dự kiến:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPrice(
                    typeof createdBooking.total === "number" ? createdBooking.total : totalPrice,
                    createdBooking.currency || selectedRoom?.currency || "VND",
                  )}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-teal-500/10 border border-teal-500/20 p-3 text-xs text-teal-800 dark:text-teal-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Clock className="h-3.5 w-3.5 text-teal-600" />
                <span>Giờ nhận phòng: {hotel.checkInTime || "14:00"} · Trả phòng: {hotel.checkOutTime || "11:00"}</span>
              </div>
              <p className="text-micro text-teal-700 dark:text-teal-400">
                Miễn phí hủy phòng trước giờ nhận phòng. Bạn có thể thanh toán trực tiếp tại khách sạn khi nhận phòng.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button asChild variant="outline" className="text-xs">
                <Link href="/reservations?tab=hotels">Xem đơn đặt của tôi</Link>
              </Button>
              {hotel.ownerUserId && (
                <Button asChild variant="outline" className="text-xs gap-1.5">
                  <Link href={`/chat?userId=${hotel.ownerUserId}`}>
                    <MessageSquare className="h-3.5 w-3.5" /> Mở Chat với KS
                  </Link>
                </Button>
              )}
              <Button onClick={handleResetAndClose} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold">
                Hoàn tất
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Room Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Chọn hạng phòng (*)</span>
                {loadingRooms && (
                  <span className="text-micro text-muted-foreground flex items-center gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" /> Đang cập nhật phòng trống...
                  </span>
                )}
              </label>

              {loadingRooms ? (
                <div className="h-20 rounded-xl border border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                  <span>Đang tải thông tin phòng trực tuyến...</span>
                </div>
              ) : rooms.length === 0 ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold">Khách sạn chưa cập nhật danh sách phòng trực tuyến.</p>
                  <p className="text-micro text-amber-700 dark:text-amber-400 mt-0.5">
                    Bạn có thể gửi tin nhắn để đối tác hỗ trợ giữ phòng trực tiếp.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {rooms.map((room) => {
                    const isSelected = selectedRoom?.id === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-teal-500 bg-teal-500/5 shadow-2xs"
                            : "border-border hover:border-foreground/30 bg-card"
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground truncate">{room.name}</span>
                            <span className="text-micro px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 shrink-0">
                              Còn {room.availableRooms} phòng
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-micro text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> Tối đa {room.capacity} khách
                            </span>
                            {room.cancellationPolicy && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ✓ Miễn phí hủy
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-teal-700 dark:text-teal-400 block">
                            {formatPrice(room.pricePerNight, room.currency || "VND")}
                          </span>
                          <span className="text-micro text-muted-foreground block">/ đêm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stay Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Ngày nhận phòng (*)
                </label>
                <Input
                  type="date"
                  value={checkIn}
                  min={toIsoDate(new Date())}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> Ngày trả phòng (*)
                </label>
                <Input
                  type="date"
                  value={checkOut}
                  min={checkIn || toIsoDate(new Date())}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Room Quantity and Guests */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Số phòng (*)</label>
                <Input
                  type="number"
                  min="1"
                  max={Math.min(5, selectedRoom?.availableRooms || 5)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Người lớn (*)</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Trẻ em</label>
                <Input
                  type="number"
                  min="0"
                  max="6"
                  value={children}
                  onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Customer Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Họ và tên khách đại diện (*)</label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Số điện thoại (*)</label>
                <Input
                  placeholder="0912 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email nhận xác nhận (*)</label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Yêu cầu đặc biệt</label>
              <Textarea
                rows={2}
                placeholder="Ví dụ: Cần phòng tầng cao yên tĩnh, check-in muộn sau 19h..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Price Preview Banner */}
            <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời gian lưu trú:</span>
                <span className="font-medium text-foreground">
                  {nights} đêm ({checkIn} → {checkOut})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số lượng phòng:</span>
                <span className="font-medium text-foreground">
                  {quantity} phòng × {formatPrice(nightlyRate, selectedRoom?.currency || "VND")}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/60">
                <span className="font-bold text-foreground">Tổng chi phí dự kiến:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400 text-sm">
                  {formatPrice(totalPrice, selectedRoom?.currency || "VND")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-micro text-emerald-600 dark:text-emerald-400 pt-1">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Miễn phí hủy phòng trước giờ nhận phòng. Giữ phòng ngay không cần thanh toán trước.</span>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleResetAndClose}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submitting || rooms.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Đang đặt phòng...
                  </span>
                ) : (
                  "Xác nhận đặt phòng ngay"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
