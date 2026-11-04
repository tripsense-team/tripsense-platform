"use client";

import * as React from "react";
import {
  Building2,
  UtensilsCrossed,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Sparkles,
  Ticket,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreateReservationOfferPayload, ChatMessageItem } from "../types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface CreateReservationOfferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Omit<CreateReservationOfferPayload, "clientMessageId">) => Promise<void>;
  defaultBusinessName?: string;
  defaultBusinessType?: "HOTEL" | "RESTAURANT" | "GUIDE";
  recentMessages?: ChatMessageItem[];
}

const RESTAURANT_TABLE_PRESETS = [
  "Bàn 2 người",
  "Bàn 4 người",
  "Bàn 6 - 8 người",
  "Bàn view cửa sổ / ban công",
  "Phòng riêng VIP",
];

const RESTAURANT_NOTE_PRESETS = [
  "Giữ bàn 15 phút sau giờ hẹn",
  "Có ghế trẻ em",
  "Khu vực không hút thuốc",
  "Chuẩn bị tiệc / kỷ niệm",
];

function parseChatInquiry(messages: ChatMessageItem[] = []) {
  const textBlob = messages
    .slice(-6)
    .map((m) => m.text)
    .join(" ");

  if (!textBlob.trim()) return null;

  const isoDates = textBlob.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const vnDates = textBlob.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g) || [];

  const normalizedDates: string[] = [];
  isoDates.forEach((d) => normalizedDates.push(d));
  vnDates.forEach((d) => {
    const parts = d.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      normalizedDates.push(`${year}-${month}-${day}`);
    }
  });

  const guestMatch = textBlob.match(/(\d+)\s*(?:khách|người|nguoi|guests|pax|vé)/i);
  const adultsCount = guestMatch ? parseInt(guestMatch[1], 10) : undefined;

  const timeMatch = textBlob.match(/\b(\d{1,2})(?:[:h](\d{2})?)\s*(?:pm|am)?\b/i);
  let timeStr: string | undefined = undefined;
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    if (hour >= 6 && hour <= 23) {
      const minute = timeMatch[2] ? timeMatch[2] : "00";
      timeStr = `${String(hour).padStart(2, "0")}:${minute}`;
    }
  }

  const isRestaurant = /nhà hàng|quán ăn|đặt bàn|restaurant|ăn tối|menu|bàn ăn/i.test(textBlob);
  const isHotel = /khách sạn|hotel|phòng|homestay|resort|checkin|nghỉ dưỡng/i.test(textBlob);

  const nameMatch = textBlob.match(/(?:tại|ở|khách sạn|nhà hàng)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s]{4,35}?)(?=\s+(?:từ|vào|ngày|cho|lúc|\.|\,|$))/i);
  const businessName = nameMatch ? nameMatch[1].trim() : undefined;

  return {
    checkInDate: normalizedDates[0],
    checkOutDate: normalizedDates[1],
    adultsCount,
    reservationTime: timeStr,
    businessType: isRestaurant ? ("RESTAURANT" as const) : isHotel ? ("HOTEL" as const) : undefined,
    businessName,
  };
}

export function CreateReservationOfferModal({
  open,
  onOpenChange,
  onSubmit,
  defaultBusinessName = "",
  defaultBusinessType = "HOTEL",
  recentMessages,
}: CreateReservationOfferModalProps) {
  const { t } = useTranslation();

  const initialParsed = React.useMemo(() => {
    return recentMessages && recentMessages.length > 0 ? parseChatInquiry(recentMessages) : null;
  }, [recentMessages]);

  const [businessType, setBusinessType] = React.useState<"HOTEL" | "RESTAURANT">(
    initialParsed?.businessType || (defaultBusinessType === "RESTAURANT" ? "RESTAURANT" : "HOTEL")
  );
  const [businessName, setBusinessName] = React.useState(initialParsed?.businessName || defaultBusinessName);
  const [itemTitle, setItemTitle] = React.useState("");
  const [checkInDate, setCheckInDate] = React.useState(initialParsed?.checkInDate || "");
  const [checkOutDate, setCheckOutDate] = React.useState(initialParsed?.checkOutDate || "");
  const [reservationTime, setReservationTime] = React.useState(initialParsed?.reservationTime || "19:00");
  const [adultsCount, setAdultsCount] = React.useState(initialParsed?.adultsCount || 2);
  const [childrenCount, setChildrenCount] = React.useState(0);
  const [totalPrice, setTotalPrice] = React.useState<number | "">("");
  const [requireDeposit, setRequireDeposit] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState<number | "">("");
  const [inclusions, setInclusions] = React.useState("");
  const [validHours, setValidHours] = React.useState(24);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isAutoPrefilled, setIsAutoPrefilled] = React.useState(
    Boolean(initialParsed?.checkInDate || initialParsed?.adultsCount || initialParsed?.businessName)
  );

  const isRestaurant = businessType === "RESTAURANT";

  // Set today / tomorrow default dates on modal open with smart prefill
  React.useEffect(() => {
    if (open) {
      setErrorMsg(null);
      let detected = false;
      const parsed = initialParsed;

      if (parsed) {
        if (parsed.checkInDate) {
          setCheckInDate(parsed.checkInDate);
          detected = true;
        }
        if (parsed.checkOutDate) {
          setCheckOutDate(parsed.checkOutDate);
        } else if (parsed.checkInDate) {
          const d = new Date(parsed.checkInDate);
          d.setDate(d.getDate() + 1);
          setCheckOutDate(d.toISOString().split("T")[0]);
        }
        if (parsed.adultsCount && parsed.adultsCount > 0) {
          setAdultsCount(parsed.adultsCount);
          detected = true;
        }
        if (parsed.reservationTime) {
          setReservationTime(parsed.reservationTime);
        }
        if (parsed.businessType) {
          setBusinessType(parsed.businessType);
        }
        if (parsed.businessName) {
          setBusinessName(parsed.businessName);
          detected = true;
        }
      }

      if (!parsed || !parsed.checkInDate) {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const toIsoDate = (d: Date) => d.toISOString().split("T")[0];
        setCheckInDate(toIsoDate(today));
        setCheckOutDate(toIsoDate(tomorrow));
      }

      if (defaultBusinessName && (!parsed || !parsed.businessName)) {
        setBusinessName(defaultBusinessName);
      }
      setIsAutoPrefilled(detected);
    }
  }, [open, defaultBusinessName, recentMessages, initialParsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!businessName.trim()) {
      setErrorMsg(t("chat.offer.businessNamePlaceholder"));
      return;
    }
    if (!itemTitle.trim()) {
      setErrorMsg(
        isRestaurant
          ? t("chat.offer.restaurantItemTitlePlaceholder", { defaultValue: "Vui lòng nhập loại bàn / vị trí xếp bàn" })
          : t("chat.offer.itemTitlePlaceholder")
      );
      return;
    }
    if (!checkInDate) {
      setErrorMsg(
        isRestaurant
          ? t("chat.offer.restaurantMealDate", { defaultValue: "Vui lòng chọn ngày đến dùng bữa" })
          : t("chat.offer.checkIn")
      );
      return;
    }
    if (!isRestaurant && checkOutDate && checkOutDate < checkInDate) {
      setErrorMsg("Ngày trả phòng phải sau hoặc bằng ngày nhận phòng");
      return;
    }

    // Pricing validation: Hotels require price > 0. Restaurants default to 0 VND (free table reservation)
    let finalPrice = 0;
    if (!isRestaurant) {
      if (typeof totalPrice !== "number" || totalPrice <= 0) {
        setErrorMsg("Vui lòng nhập tổng chi phí phòng hợp lệ");
        return;
      }
      finalPrice = totalPrice;
    } else {
      if (requireDeposit) {
        if (typeof depositAmount !== "number" || depositAmount <= 0) {
          setErrorMsg("Vui lòng nhập số tiền cọc hợp lệ hoặc bỏ chọn yêu cầu tiền cọc");
          return;
        }
        finalPrice = depositAmount;
      } else {
        finalPrice = 0;
      }
    }

    // Ensure reservationTime is valid HH:mm:ss for backend SQL Time
    const formattedReservationTime = isRestaurant && reservationTime
      ? (reservationTime.length === 5 ? `${reservationTime}:00` : reservationTime)
      : undefined;

    setIsSubmitting(true);
    try {
      await onSubmit({
        businessType,
        businessId: "00000000-0000-0000-0000-000000000000",
        businessName: businessName.trim(),
        itemTitle: itemTitle.trim(),
        checkInDate,
        checkOutDate: !isRestaurant ? checkOutDate || undefined : undefined,
        reservationTime: formattedReservationTime,
        adultsCount: Math.max(1, adultsCount),
        childrenCount: Math.max(0, childrenCount),
        totalPrice: finalPrice,
        currency: "VND",
        inclusions: inclusions.trim() || undefined,
        validHours,
      });
      onOpenChange(false);
      // Reset form
      setItemTitle("");
      setTotalPrice("");
      setDepositAmount("");
      setRequireDeposit(false);
      setInclusions("");
    } catch {
      setErrorMsg(t("chat.errors.actionFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-bold">
            {isRestaurant ? (
              <UtensilsCrossed className="h-5 w-5" />
            ) : (
              <Ticket className="h-5 w-5" />
            )}
            <DialogTitle>
              {isRestaurant
                ? t("chat.offer.restaurantTitle", { defaultValue: "Tạo phiếu đặt bàn nhà hàng" })
                : t("chat.offer.createTitle")}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isRestaurant
              ? t("chat.offer.restaurantDesc", {
                  defaultValue: "Tạo phiếu giữ bàn ăn để khách xác nhận trực tiếp trong đoạn chat.",
                })
              : t("chat.offer.createDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {isAutoPrefilled && (
            <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-xl font-medium">
              <Sparkles className="h-4 w-4 shrink-0 text-primary animate-pulse" />
              <span>{t("chat.offer.smartPrefillDetected", { defaultValue: "Đã tự động nhận diện ngày và số khách từ tin nhắn của khách." })}</span>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs font-medium text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
              {errorMsg}
            </div>
          )}

          {/* Business Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {t("chat.offer.businessType")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={businessType === "HOTEL" ? "default" : "outline"}
                className={cn(
                  "h-10 justify-center gap-2 rounded-xl font-bold transition-all",
                  businessType === "HOTEL" && "shadow-xs"
                )}
                onClick={() => setBusinessType("HOTEL")}
              >
                <Building2 className="h-4 w-4" />
                <span>{t("chat.offer.hotel")}</span>
              </Button>

              <Button
                type="button"
                variant={businessType === "RESTAURANT" ? "default" : "outline"}
                className={cn(
                  "h-10 justify-center gap-2 rounded-xl font-bold transition-all",
                  businessType === "RESTAURANT" && "shadow-xs"
                )}
                onClick={() => setBusinessType("RESTAURANT")}
              >
                <UtensilsCrossed className="h-4 w-4" />
                <span>{t("chat.offer.restaurant")}</span>
              </Button>
            </div>
          </div>

          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {isRestaurant ? "Tên nhà hàng *" : `${t("chat.offer.businessName")} *`}
            </label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={isRestaurant ? "VD: Hawa's Food Đà Nẵng..." : t("chat.offer.businessNamePlaceholder")}
              required
              className="h-10 rounded-xl"
            />
          </div>

          {/* Item Title / Table Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {isRestaurant
                ? `${t("chat.offer.restaurantItemTitle", { defaultValue: "Khu vực / Loại bàn đặt" })} *`
                : `${t("chat.offer.itemTitle")} *`}
            </label>
            <Input
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              placeholder={
                isRestaurant
                  ? t("chat.offer.restaurantItemTitlePlaceholder", { defaultValue: "VD: Bàn 4 khách view cửa sổ, Bàn phòng riêng..." })
                  : "VD: Phòng Deluxe King view sông Hàn..."
              }
              required
              className="h-10 rounded-xl"
            />

            {/* Quick Chips for Restaurant */}
            {isRestaurant && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {RESTAURANT_TABLE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setItemTitle(preset)}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer",
                      itemTitle === preset
                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                        : "bg-muted/50 text-muted-foreground border-border/70 hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dates & Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>
                  {isRestaurant
                    ? `${t("chat.offer.restaurantMealDate", { defaultValue: "Ngày dùng bữa" })} *`
                    : `${t("chat.offer.checkIn")} *`}
                </span>
              </label>
              <Input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                required
                className="h-10 rounded-xl font-medium"
              />
            </div>

            {!isRestaurant ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>{t("chat.offer.checkOut")} *</span>
                </label>
                <Input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  required
                  className="h-10 rounded-xl font-medium"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <span>{t("chat.offer.restaurantMealTime", { defaultValue: "Giờ đến" })} *</span>
                </label>
                <Input
                  type="time"
                  value={reservationTime}
                  onChange={(e) => setReservationTime(e.target.value)}
                  required
                  className="h-10 rounded-xl font-medium"
                />
              </div>
            )}
          </div>

          {/* Guests Section */}
          <div className={cn("grid gap-3", !isRestaurant ? "grid-cols-3" : "grid-cols-2")}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{t("chat.offer.adults")}</span>
              </label>
              <Input
                type="number"
                min={1}
                max={50}
                value={adultsCount}
                onChange={(e) => setAdultsCount(parseInt(e.target.value, 10) || 1)}
                className="h-10 rounded-xl font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                <span>{t("chat.offer.children")}</span>
              </label>
              <Input
                type="number"
                min={0}
                max={30}
                value={childrenCount}
                onChange={(e) => setChildrenCount(parseInt(e.target.value, 10) || 0)}
                className="h-10 rounded-xl font-medium"
              />
            </div>

            {!isRestaurant && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-primary" />
                  <span>{t("chat.offer.totalPrice")} *</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  step={50000}
                  value={totalPrice}
                  onChange={(e) =>
                    setTotalPrice(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="1500000"
                  required
                  className="h-10 rounded-xl font-bold text-primary"
                />
              </div>
            )}
          </div>

          {/* Pricing Box for Restaurant (Zero-Cost / Free Table Hold by default) */}
          {isRestaurant && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {t("chat.offer.freeTableReservation", { defaultValue: "Miễn phí đặt bàn (0 ₫)" })}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      {t("chat.offer.payAtRestaurantNote", {
                        defaultValue: "Thanh toán món ăn trực tiếp tại quán sau khi dùng bữa",
                      })}
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={requireDeposit}
                    onChange={(e) => {
                      setRequireDeposit(e.target.checked);
                      if (!e.target.checked) setDepositAmount("");
                    }}
                    className="rounded border-border text-primary focus:ring-primary size-3.5"
                  />
                  <span>{t("chat.offer.requireDeposit", { defaultValue: "Yêu cầu cọc trước" })}</span>
                </label>
              </div>

              {requireDeposit && (
                <div className="pt-2 border-t border-border/50 flex items-center gap-2">
                  <span className="text-xs font-semibold shrink-0 text-foreground">
                    Tiền cọc giữ chỗ:
                  </span>
                  <Input
                    type="number"
                    min={10000}
                    step={50000}
                    value={depositAmount}
                    onChange={(e) =>
                      setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder={t("chat.offer.depositPlaceholder", { defaultValue: "Nhập số tiền cọc (VD: 200000)" })}
                    className="h-8 text-xs font-bold text-primary rounded-lg flex-1"
                  />
                  <span className="text-xs font-bold text-muted-foreground">VND</span>
                </div>
              )}
            </div>
          )}

          {/* Inclusions / Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>
                {isRestaurant
                  ? t("chat.offer.restaurantNotes", { defaultValue: "Ghi chú xếp bàn / Lưu ý của quán" })
                  : t("chat.offer.inclusions")}
              </span>
            </label>
            <Textarea
              value={inclusions}
              onChange={(e) => setInclusions(e.target.value)}
              placeholder={
                isRestaurant
                  ? t("chat.offer.restaurantNotesPlaceholder", {
                      defaultValue: "VD: Quán giữ bàn tối đa 15 phút sau giờ hẹn, có ghế trẻ em...",
                    })
                  : t("chat.offer.inclusionsPlaceholder")
              }
              rows={2}
              className="rounded-xl resize-none text-xs"
            />

            {/* Quick Note Presets for Restaurant */}
            {isRestaurant && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {RESTAURANT_NOTE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setInclusions((prev) => {
                        const trimmed = prev.trim();
                        if (!trimmed) return preset;
                        if (trimmed.includes(preset)) return trimmed;
                        return `${trimmed}, ${preset}`;
                      });
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/60 hover:border-primary/40 hover:text-foreground transition-all cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Validity Duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{t("chat.offer.validHours")}</span>
            </label>
            <div className="flex gap-2">
              {[2, 6, 12, 24, 48].map((hours) => (
                <Button
                  key={hours}
                  type="button"
                  variant={validHours === hours ? "default" : "outline"}
                  size="sm"
                  onClick={() => setValidHours(hours)}
                  className="flex-1 h-8 rounded-lg text-xs font-semibold"
                >
                  {t("chat.offer.validHoursOption", { hours })}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl gap-2 font-bold px-6 shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ticket className="h-4 w-4" />
              )}
              <span>{t("chat.offer.sendAction")}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
