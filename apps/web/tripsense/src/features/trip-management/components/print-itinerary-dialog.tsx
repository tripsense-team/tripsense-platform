"use client";

import * as React from "react";
import {
  Calendar,
  Compass,
  Download,
  FileDown,
  MapPin,
  Printer,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { downloadTripIcs } from "../utils/export-itinerary";
import type { ItineraryResponse, TripResponse } from "../types";
import { formatShortRange } from "../utils/format";

interface PrintItineraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripResponse;
  itinerary?: ItineraryResponse | null;
}

export function PrintItineraryDialog({
  open,
  onOpenChange,
  trip,
  itinerary,
}: PrintItineraryDialogProps) {
  const { t, locale } = useTranslation();

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleDownloadIcs = () => {
    downloadTripIcs(trip, itinerary);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Dialog Header / Controls (hidden on paper print) */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/30 print:hidden">
          <div>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              <span>{t("trip.exportItinerary", { defaultValue: "Xuất & In Lịch trình" })}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {t("trip.previewPrintDesc", {
                defaultValue: "Xem trước bản in A4 hoặc tải file đồng bộ vào lịch điện thoại (Google Calendar, Apple iCal, Outlook).",
              })}
            </DialogDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadIcs}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{t("trip.downloadIcs", { defaultValue: "Tải file .ics" })}</span>
            </Button>

            <Button
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{t("trip.printPdf", { defaultValue: "In / Lưu PDF" })}</span>
            </Button>
          </div>
        </div>

        {/* Printable Sheet Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 bg-background text-foreground print:p-0 print:m-0">
          {/* Trip Header Banner */}
          <div className="border-b border-border/80 pb-5 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-semibold">
                TripSense Itinerary
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatShortRange(trip.startDate, trip.endDate)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {trip.name}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {trip.destinationName}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {trip.travelerCount} {t("trip.travelers", { defaultValue: "người tham gia" })}
              </span>
              {trip.budgetAmount && (
                <span className="flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  {trip.budgetAmount.toLocaleString()} {trip.budgetCurrency || "VND"}
                </span>
              )}
            </div>

            {trip.notes && (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-xl border border-border/40 mt-2">
                "{trip.notes}"
              </p>
            )}
          </div>

          {/* Days Schedule */}
          {itinerary?.days && itinerary.days.length > 0 ? (
            <div className="space-y-6">
              {itinerary.days.map((day, dIdx) => (
                <div
                  key={day.id || dIdx}
                  className="space-y-3 break-inside-avoid border border-border/60 rounded-2xl p-4.5 bg-card/50"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <span className="flex h-5.5 w-5.5 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-mono">
                        {dIdx + 1}
                      </span>
                      <span>
                        {locale === "vi" ? `Ngày ${day.dayNumber || dIdx + 1}` : `Day ${day.dayNumber || dIdx + 1}`}
                      </span>
                    </h3>
                    {day.date && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {day.date}
                      </span>
                    )}
                  </div>

                  {day.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic pl-2">
                      {t("trip.noActivitiesInDay", { defaultValue: "Chưa có hoạt động nào trong ngày này." })}
                    </p>
                  ) : (
                    <div className="space-y-2.5 pl-2">
                      {day.items.map((item, iIdx) => (
                        <div
                          key={item.id || iIdx}
                          className="flex items-start gap-3 text-xs border-l-2 border-primary/30 pl-3 py-0.5"
                        >
                          <div className="w-16 shrink-0 font-mono text-muted-foreground text-[11px] pt-0.5">
                            {item.startTime
                              ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`
                              : `--:--`}
                          </div>

                          <div className="flex-1 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-foreground text-[13px]">
                                {item.title || item.placeNameSnapshot || "Điểm tham quan"}
                              </span>
                              {item.type && (
                                <Badge variant="secondary" className="text-[11px] font-normal px-1.5 py-0">
                                  {item.type}
                                </Badge>
                              )}
                            </div>

                            {(item.placeAddressSnapshot || item.placeNameSnapshot) && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary shrink-0" />
                                <span>{item.placeAddressSnapshot || item.placeNameSnapshot}</span>
                              </p>
                            )}

                            {item.notes && (
                              <p className="text-muted-foreground text-[11px] leading-relaxed">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              {t("trip.emptyItinerary", { defaultValue: "Chưa có lịch trình chi tiết cho chuyến đi này." })}
            </p>
          )}

          {/* Footer watermark on print */}
          <div className="text-center pt-4 border-t border-border/40 text-[11px] text-muted-foreground">
            Lịch trình được tạo trên TripSense (tripsense.app) · Nền tảng du lịch & lịch trình thông minh
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
