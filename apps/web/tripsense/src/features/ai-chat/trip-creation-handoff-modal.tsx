/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import {
  Calendar,
  Check,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AiItineraryPreview } from "./types";
import type { TripResponse } from "@/features/trip-management/types";
import {
  createTrip,
  getItinerary,
  createItineraryItem,
} from "@/features/trip-management/services/trip-management-api";
import { ApprovedPlaceImage } from "./approved-place-image";

export interface TripCreationHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview?: AiItineraryPreview;
  existingTrips?: TripResponse[];
  selectedTripId?: string;
  onSuccess: (tripId: string) => void;
}

function formatDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTimeToLocalTime(raw?: string): { startTime?: string; endTime?: string; durationMinutes?: number } {
  if (!raw) return {};
  const clean = raw.trim();
  const rangeMatch = clean.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  if (rangeMatch) {
    const s = rangeMatch[1].padStart(5, "0");
    const e = rangeMatch[2].padStart(5, "0");
    if (s < e) {
      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = e.split(":").map(Number);
      const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
      return { startTime: s, endTime: e, durationMinutes: Math.max(15, Math.min(720, durationMinutes)) };
    }
    return { startTime: s, durationMinutes: 60 };
  }
  const singleMatch = clean.match(/^(\d{1,2}:\d{2})/);
  if (singleMatch) {
    return { startTime: singleMatch[1].padStart(5, "0"), durationMinutes: 60 };
  }
  return {};
}

export function TripCreationHandoffModal({
  isOpen,
  onClose,
  preview,
  existingTrips = [],
  selectedTripId,
  onSuccess,
}: TripCreationHandoffModalProps) {
  const days = React.useMemo(() => preview?.days || [], [preview]);
  const daysCount = Math.max(1, days.length);

  // Extract default values from preview
  const defaultDestination = React.useMemo(() => {
    const allText = [
      preview?.explanation || "",
      ...days.flatMap((d) => (d.items || []).map((it) => `${it.title} ${it.address || ""}`)),
    ].join(" ");

    const destinations = ["Đà Nẵng", "Hội An", "Huế", "Hà Nội", "Hồ Chí Minh", "Sài Gòn", "Đà Lạt", "Nha Trang", "Phú Quốc", "Sapa", "Quy Nhơn", "Vũng Tàu"];
    for (const dest of destinations) {
      if (allText.includes(dest)) return dest;
    }
    return "Đà Nẵng";
  }, [preview, days]);

  const defaultDates = React.useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // If preview has a date string and it's not in the past
    const firstPreviewDate = days[0]?.date;
    let startDateObj = tomorrow;
    if (firstPreviewDate && /^\d{4}-\d{2}-\d{2}$/.test(firstPreviewDate)) {
      const parsed = new Date(firstPreviewDate);
      if (!isNaN(parsed.getTime()) && parsed >= today) {
        startDateObj = parsed;
      }
    }

    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + daysCount - 1);

    return {
      start: formatDateToIso(startDateObj),
      end: formatDateToIso(endDateObj),
    };
  }, [days, daysCount]);

  // Form states
  const [mode, setMode] = React.useState<"NEW" | "EXISTING">(
    selectedTripId && existingTrips.some((t) => t.id === selectedTripId) ? "EXISTING" : "NEW"
  );
  const [tripName, setTripName] = React.useState("");
  const [destinationName, setDestinationName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [travelerCount, setTravelerCount] = React.useState<number>(2);
  const [budgetAmount, setBudgetAmount] = React.useState<string>("");
  const [targetTripId, setTargetTripId] = React.useState<string>(selectedTripId || "");

  // Selected stop keys: `${dayNumber}_${item.canonicalPlaceId}_${index}`
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitStep, setSubmitStep] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Initialize/Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTripName(`Chuyến đi ${defaultDestination} ${daysCount} ngày`);
      setDestinationName(defaultDestination);
      setStartDate(defaultDates.start);
      setEndDate(defaultDates.end);
      setTravelerCount(2);
      setBudgetAmount("");
      setMode(selectedTripId && existingTrips.some((t) => t.id === selectedTripId) ? "EXISTING" : "NEW");
      setTargetTripId(selectedTripId || (existingTrips[0]?.id ?? ""));
      setErrorMessage(null);
      setIsSubmitting(false);

      // Default: Select all items in preview
      const allItemKeys = new Set<string>();
      days.forEach((day) => {
        (day.items || []).forEach((item, index) => {
          allItemKeys.add(`${day.dayNumber}_${item.canonicalPlaceId}_${index}`);
        });
      });
      setSelectedItems(allItemKeys);
    }
  }, [isOpen, defaultDestination, defaultDates, daysCount, days, selectedTripId, existingTrips]);

  // Auto recalculate end date when start date changes
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (!newStart) return;
    const startObj = new Date(newStart);
    if (!isNaN(startObj.getTime())) {
      const endObj = new Date(startObj);
      endObj.setDate(startObj.getDate() + daysCount - 1);
      setEndDate(formatDateToIso(endObj));
    }
  };

  const totalItemsCount = React.useMemo(() => {
    return days.reduce((sum, day) => sum + (day.items?.length || 0), 0);
  }, [days]);

  const toggleItem = (key: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    const all = new Set<string>();
    days.forEach((day) => {
      (day.items || []).forEach((item, index) => {
        all.add(`${day.dayNumber}_${item.canonicalPlaceId}_${index}`);
      });
    });
    setSelectedItems(all);
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedItems.size === 0) {
      setErrorMessage("Vui lòng chọn ít nhất 1 địa điểm để tạo lịch trình.");
      return;
    }

    setIsSubmitting(true);

    try {
      let finalTripId: string;

      if (mode === "NEW") {
        if (!tripName.trim()) throw new Error("Vui lòng nhập tên chuyến đi.");
        if (!destinationName.trim()) throw new Error("Vui lòng nhập điểm đến.");
        if (!startDate || !endDate) throw new Error("Vui lòng chọn ngày đi và ngày về.");

        setSubmitStep("Đang khởi tạo chuyến đi...");
        const parsedBudget = budgetAmount ? parseFloat(budgetAmount) : undefined;

        const createdTrip = await createTrip({
          name: tripName.trim(),
          destinationName: destinationName.trim(),
          startDate,
          endDate,
          travelerCount: travelerCount || 1,
          budgetAmount: parsedBudget && !isNaN(parsedBudget) ? parsedBudget : undefined,
          budgetCurrency: "VND",
          notes: "Lịch trình được tạo tự động từ gợi ý của TripSense AI Planner",
        });

        finalTripId = createdTrip.id;
      } else {
        if (!targetTripId) throw new Error("Vui lòng chọn chuyến đi cần thêm địa điểm.");
        finalTripId = targetTripId;
      }

      // Fetch days of the trip to populate items
      setSubmitStep("Đang chuẩn bị lịch trình...");
      const itinerary = await getItinerary(finalTripId);
      const itineraryDays = itinerary.days || [];

      if (itineraryDays.length === 0) {
        throw new Error("Chuyến đi chưa có cấu trúc ngày lịch trình hợp lệ.");
      }

      setSubmitStep(`Đang lưu ${selectedItems.size} địa điểm vào các ngày...`);

      // Populate items per day
      let addedCount = 0;
      for (const day of days) {
        // Find corresponding day in trip
        const targetDay =
          itineraryDays.find((d) => d.dayNumber === day.dayNumber) ||
          itineraryDays[Math.min(day.dayNumber - 1, itineraryDays.length - 1)];

        if (!targetDay) continue;

        const dayItems = (day.items || []).filter((item, index) =>
          selectedItems.has(`${day.dayNumber}_${item.canonicalPlaceId}_${index}`)
        );

        for (const item of dayItems) {
          const timing = parseTimeToLocalTime(item.startTime);
          try {
            await createItineraryItem(finalTripId, targetDay.id, {
              type: "PLACE",
              title: item.title,
              startTime: timing.startTime,
              endTime: timing.endTime,
              durationMinutes: timing.durationMinutes,
              notes: item.address ? `Địa chỉ: ${item.address}` : undefined,
            });
            addedCount++;
            setSubmitStep(`Đã lưu ${addedCount}/${selectedItems.size} địa điểm...`);
          } catch (err) {
            console.warn(`Could not add item "${item.title}":`, err);
          }
        }
      }

      setSubmitStep("Hoàn tất! Đang chuyển hướng...");
      onSuccess(finalTripId);
      onClose();
    } catch (err: unknown) {
      console.error("Trip creation from chat failed:", err);
      setErrorMessage((err as Error)?.message || "Không thể tạo chuyến đi. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Chuyển giao kế hoạch từ AI Planner</span>
          </div>
          <DialogTitle className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
            Tạo Chuyến Đi & Lưu Lịch Trình
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lưu các địa điểm bạn đã thảo luận vào chuyến đi thực tế để quản lý timeline, bản đồ và chi tiêu.
          </p>

          {/* Mode Selector */}
          {existingTrips.length > 0 && (
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => setMode("NEW")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mode === "NEW"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                + Tạo chuyến đi mới
              </button>
              <button
                type="button"
                onClick={() => setMode("EXISTING")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  mode === "EXISTING"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Thêm vào chuyến đi đã có ({existingTrips.length})
              </button>
            </div>
          )}
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Trip Details Section */}
          {mode === "NEW" ? (
            <div className="space-y-3.5 rounded-xl border border-border/80 bg-background/60 p-4">
              <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Thông tin chuyến đi mới
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Tên chuyến đi *</label>
                  <input
                    type="text"
                    required
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    placeholder="VD: Chuyến đi Đà Nẵng 3 ngày"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Điểm đến *</label>
                  <input
                    type="text"
                    required
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    placeholder="VD: Đà Nẵng"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Ngày bắt đầu *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    min={formatDateToIso(new Date())}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Ngày kết thúc * ({daysCount} ngày)
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Số người
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={travelerCount}
                    onChange={(e) => setTravelerCount(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Ngân sách dự kiến (VND)
                  </label>
                  <input
                    type="number"
                    step={100000}
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    placeholder="VD: 3000000"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-border/80 bg-background/60 p-4">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                Chọn chuyến đi cần nhập địa điểm
              </label>
              <select
                value={targetTripId}
                onChange={(e) => setTargetTripId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {existingTrips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} · {trip.destinationName} ({trip.startDate} - {trip.endDate})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Place Curation List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div>
                <h4 className="font-semibold text-xs text-foreground">
                  Chọn địa điểm đưa vào lịch trình ({selectedItems.size}/{totalItemsCount})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Bỏ chọn những điểm bạn không muốn thêm vào chuyến đi này.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Chọn tất cả
                </button>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            {/* Days Breakdown */}
            <div className="space-y-3">
              {days.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Chưa có địa điểm nào được gợi ý trong cuộc trò chuyện.
                </div>
              ) : (
                days.map((day) => {
                  const dayItems = day.items || [];
                return (
                  <div
                    key={`day-${day.dayNumber}`}
                    className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-foreground px-1">
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary text-[11px]">
                          {day.dayNumber}
                        </span>
                        Ngày {day.dayNumber}
                        {day.date ? ` · ${day.date}` : ""}
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {dayItems.length} địa điểm
                      </span>
                    </div>

                    <div className="space-y-2">
                      {dayItems.map((item, index) => {
                        const itemKey = `${day.dayNumber}_${item.canonicalPlaceId}_${index}`;
                        const isChecked = selectedItems.has(itemKey);

                        return (
                          <div
                            key={itemKey}
                            onClick={() => toggleItem(itemKey)}
                            className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              isChecked
                                ? "border-primary/50 bg-card shadow-2xs hover:border-primary"
                                : "border-border/60 bg-muted/40 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                  isChecked
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-muted-foreground/40 bg-background"
                                }`}
                                aria-label={isChecked ? "Bỏ chọn" : "Chọn"}
                              >
                                {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </button>

                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                <ApprovedPlaceImage
                                  photo={item.primaryPhoto}
                                  name={item.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="min-w-0">
                                <h5 className="font-semibold text-xs text-foreground truncate">
                                  {item.title}
                                </h5>
                                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                  {item.address ? (
                                    <span>{item.address}</span>
                                  ) : (
                                    <span>Địa điểm tham quan</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {item.startTime && (
                              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>{item.startTime}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Footer Submit Actions */}
          <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border bg-card/95 backdrop-blur-md p-4 flex items-center justify-between gap-3 shadow-lg">
            <div className="text-xs text-muted-foreground truncate">
              {isSubmitting ? (
                <span className="flex items-center gap-1.5 text-primary font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {submitStep || "Đang xử lý..."}
                </span>
              ) : (
                <span>
                  Đã chọn <strong>{selectedItems.size}</strong> địa điểm
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={onClose}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || selectedItems.size === 0}
                className="gap-1.5 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{mode === "NEW" ? "Tạo chuyến đi & Lưu" : "Lưu vào chuyến đi"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
