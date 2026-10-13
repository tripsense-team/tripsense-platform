"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  startOfToday,
  parseISO,
} from "date-fns";
import { ModalBackdrop } from "./modal-backdrop";
import { useTranslation } from "@/i18n";

type WhenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
  onSave: (data: {
    type: "dates" | "flexible";
    startDate?: string;
    endDate?: string;
    flexiblePeriod?: string;
    flexibleMonths?: string[];
  }) => void;
  zIndexClassName?: string;
};

export function WhenModal({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  onSave,
  zIndexClassName,
}: WhenModalProps) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<"dates" | "flexible">("dates");
  const today = React.useMemo(() => startOfToday(), []);

  // Calendar base month (left month)
  const [baseMonth, setBaseMonth] = React.useState<Date>(today);
  const nextMonth = React.useMemo(() => addMonths(baseMonth, 1), [baseMonth]);

  // Selected date range
  const [startDate, setStartDate] = React.useState<Date | null>(
    initialStartDate ? parseISO(initialStartDate) : null
  );
  const [endDate, setEndDate] = React.useState<Date | null>(
    initialEndDate ? parseISO(initialEndDate) : null
  );
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

  // Flexible tab state
  const [flexiblePeriod, setFlexiblePeriod] = React.useState<string>("1week");
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>([]);

  const dayLabels = React.useMemo(
    () =>
      locale === "vi"
        ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
        : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    [locale]
  );

  React.useEffect(() => {
    if (initialStartDate) setStartDate(parseISO(initialStartDate));
    if (initialEndDate) setEndDate(parseISO(initialEndDate));
  }, [initialStartDate, initialEndDate, isOpen]);

  const handlePrevMonth = () => {
    setBaseMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setBaseMonth((prev) => addMonths(prev, 1));
  };

  const handleDateClick = (day: Date) => {
    if (isBefore(day, today)) return;

    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(day);
      setEndDate(null);
    } else if (startDate && !endDate) {
      if (isBefore(day, startDate)) {
        // If clicked before start date, reset start date
        setStartDate(day);
      } else {
        // Set end date
        setEndDate(day);
      }
    }
  };

  const handleSave = () => {
    if (activeTab === "dates") {
      onSave({
        type: "dates",
        startDate: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
        endDate: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
      });
    } else {
      onSave({
        type: "flexible",
        flexiblePeriod,
        flexibleMonths: selectedMonths,
      });
    }
    onClose();
  };

  const formatMonthTitle = (monthDate: Date) => {
    if (locale === "vi") {
      return `Tháng ${format(monthDate, "M yyyy")}`;
    }
    return format(monthDate, "MMMM yyyy");
  };

  // Helper to render month days grid
  const renderMonthCalendar = (monthDate: Date, showPrevArrow: boolean, showNextArrow: boolean) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const startDateGrid = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDateGrid = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const allDays = eachDayOfInterval({ start: startDateGrid, end: endDateGrid });

    return (
      <div className="flex-1 min-w-[260px]">
        {/* Month Header with Navigation Arrow */}
        <div className="flex items-center justify-between mb-4 h-8 px-1">
          {showPrevArrow ? (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-full text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}

          <span className="font-semibold text-sm tracking-tight text-foreground">
            {formatMonthTitle(monthDate)}
          </span>

          {showNextArrow ? (
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-full text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Weekday headers: CN, T2, T3, T4, T5, T6, T7 */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="text-[11px] font-medium text-muted-foreground/80 py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {allDays.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, monthDate);
            const isPast = isBefore(day, today);
            const isStart = startDate ? isSameDay(day, startDate) : false;
            const isEnd = endDate ? isSameDay(day, endDate) : false;
            const isSelected = isStart || isEnd;

            // In-range calculation
            const effectiveEnd = endDate || hoverDate;
            const inRange =
              startDate &&
              effectiveEnd &&
              !isBefore(effectiveEnd, startDate) &&
              isWithinInterval(day, { start: startDate, end: effectiveEnd });

            if (!isCurrentMonth) {
              return <div key={idx} className="h-9 w-9" />;
            }

            return (
              <div
                key={day.toISOString()}
                className={`relative flex items-center justify-center h-9 ${
                  inRange && !isSelected ? "bg-muted/60" : ""
                } ${isStart && startDate && effectiveEnd && !isSameDay(startDate, effectiveEnd) ? "rounded-l-full" : ""} ${
                  isEnd && startDate && endDate && !isSameDay(startDate, endDate) ? "rounded-r-full" : ""
                }`}
              >
                <button
                  type="button"
                  disabled={isPast}
                  onClick={() => handleDateClick(day)}
                  onMouseEnter={() => {
                    if (startDate && !endDate) setHoverDate(day);
                  }}
                  className={`size-8 rounded-full text-xs font-medium transition-all flex items-center justify-center ${
                    isPast
                      ? "text-muted-foreground/35 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${
                    isSelected
                      ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-semibold shadow-xs"
                      : isPast
                      ? ""
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {format(day, "d")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ModalBackdrop
      isOpen={isOpen}
      onClose={onClose}
      title={t("trip.intakeWhenTitle") || "When"}
      maxWidth="max-w-2xl"
      zIndexClassName={zIndexClassName}
    >
      <div className="flex flex-col space-y-6">
        {/* Segmented Pill Tabs: Dates | Flexible */}
        <div className="flex justify-center -mt-2">
          <div className="inline-flex rounded-full bg-muted/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("dates")}
              className={`rounded-full px-5 py-1.5 font-semibold transition-all cursor-pointer ${
                activeTab === "dates"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("trip.intakeDates") || "Dates"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flexible")}
              className={`rounded-full px-5 py-1.5 font-semibold transition-all cursor-pointer ${
                activeTab === "flexible"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("trip.intakeFlexible") || "Flexible"}
            </button>
          </div>
        </div>

        {/* Tab 1: Dual Calendar Grid */}
        {activeTab === "dates" ? (
          <div className="flex flex-col md:flex-row gap-8 justify-center px-1">
            {renderMonthCalendar(baseMonth, true, false)}
            <div className="hidden md:block w-px bg-border/40" />
            {renderMonthCalendar(nextMonth, false, true)}
          </div>
        ) : (
          /* Tab 2: Flexible Picker */
          <div className="flex flex-col space-y-6 py-2 px-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 text-center">
                {t("trip.intakeStayDuration") || "Stay for how long?"}
              </h4>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { id: "weekend", label: t("trip.intakeWeekend") || "Weekend" },
                  { id: "1week", label: t("trip.intakeWeek") || "A week" },
                  { id: "1month", label: t("trip.intakeMonth") || "A month" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFlexiblePeriod(item.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      flexiblePeriod === item.id
                        ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-transparent shadow-xs"
                        : "border-border/80 bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer: Update button aligned to right matching Screenshot 6 */}
        <div className="flex justify-end pt-4 border-t border-border/40">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-neutral-800 hover:bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white px-8 py-2.5 text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            {t("common.update") || "Update"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
