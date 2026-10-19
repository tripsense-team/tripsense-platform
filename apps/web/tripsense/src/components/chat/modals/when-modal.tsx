"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Calendar } from "lucide-react";
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
import { resolveFlexibleDates } from "@/features/trip-management/utils/date";

type WhenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "dates" | "flexible";
  initialStartDate?: string;
  initialEndDate?: string;
  initialDurationDays?: number;
  initialFlexibleMonths?: string[];
  onSave: (data: {
    type: "dates" | "flexible";
    startDate?: string;
    endDate?: string;
    flexibleMonths?: string[];
    durationDays?: number;
  }) => void;
  zIndexClassName?: string;
};

export function WhenModal({
  isOpen,
  onClose,
  initialType,
  initialStartDate,
  initialEndDate,
  initialDurationDays,
  initialFlexibleMonths,
  onSave,
  zIndexClassName,
}: WhenModalProps) {
  const { t, locale } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<"dates" | "flexible">(() => {
    if (initialType) return initialType;
    if (!initialStartDate && (initialDurationDays || initialFlexibleMonths?.length)) return "flexible";
    return "dates";
  });
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
  const [durationDays, setDurationDays] = React.useState<number>(
    initialDurationDays || 3
  );
  const [selectedMonths, setSelectedMonths] = React.useState<string[]>(
    initialFlexibleMonths || []
  );

  const monthsScrollRef = React.useRef<HTMLDivElement>(null);

  const availableMonths = React.useMemo(() => {
    const list: { id: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = addMonths(today, i);
      const mNum = format(d, "M");
      const label = locale === "vi" ? `Tháng ${mNum}` : format(d, "MMM yyyy");
      list.push({ id: `Tháng ${mNum}`, label });
    }
    return list;
  }, [today, locale]);

  const handleToggleMonth = (monthId: string) => {
    setSelectedMonths((prev) =>
      prev.includes(monthId)
        ? prev.filter((m) => m !== monthId)
        : [...prev, monthId]
    );
  };

  const handleScrollMonthsRight = () => {
    if (monthsScrollRef.current) {
      monthsScrollRef.current.scrollBy({ left: 180, behavior: "smooth" });
    }
  };

  const dayLabels = React.useMemo(
    () =>
      locale === "vi"
        ? ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
        : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    [locale]
  );

  React.useEffect(() => {
    if (initialType) {
      setActiveTab(initialType);
    } else if (!initialStartDate && (initialDurationDays || initialFlexibleMonths?.length)) {
      setActiveTab("flexible");
    } else if (initialStartDate && !initialDurationDays && !initialFlexibleMonths?.length) {
      setActiveTab("dates");
    }
    if (initialStartDate) setStartDate(parseISO(initialStartDate));
    if (initialEndDate) setEndDate(parseISO(initialEndDate));
    if (initialDurationDays) setDurationDays(initialDurationDays);
    if (initialFlexibleMonths) setSelectedMonths(initialFlexibleMonths);
  }, [initialType, initialStartDate, initialEndDate, initialDurationDays, initialFlexibleMonths, isOpen]);

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
      const resolved = resolveFlexibleDates(durationDays, selectedMonths);
      onSave({
        type: "flexible",
        durationDays,
        flexibleMonths: selectedMonths,
        startDate: resolved.startDate,
        endDate: resolved.endDate,
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
          /* Tab 2: Flexible Picker matching Mindtrip Screenshot */
          <div className="flex flex-col space-y-8 py-3 px-2 sm:px-6">
            {/* Section 1: How many days? */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-foreground mb-4 text-center">
                {t("trip.intakeHowManyDays") || "How many days?"}
              </h4>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setDurationDays((prev) => Math.max(1, prev - 1))}
                  className="size-9 rounded-full border border-border/80 flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  title="Giảm số ngày"
                >
                  <Minus className="size-4" />
                </button>
                <div className="min-w-[100px] text-center px-6 py-2 rounded-full border border-border/80 bg-background text-lg font-semibold text-foreground shadow-2xs">
                  {durationDays}
                </div>
                <button
                  type="button"
                  onClick={() => setDurationDays((prev) => Math.min(60, prev + 1))}
                  className="size-9 rounded-full border border-border/80 flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  title="Tăng số ngày"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Section 2: Travel anytime (Month picker) */}
            <div className="flex flex-col">
              <h4 className="text-base font-semibold text-foreground mb-4 text-center">
                {t("trip.intakeTravelAnytime") || "Travel anytime"}
              </h4>
              <div className="relative flex items-center">
                <div
                  ref={monthsScrollRef}
                  className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 w-full"
                >
                  {availableMonths.map((m) => {
                    const isSelected = selectedMonths.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleToggleMonth(m.id)}
                        className={`flex flex-col items-center justify-center min-w-[100px] h-28 rounded-2xl border p-3 transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? "border-foreground bg-muted/60 text-foreground shadow-2xs font-semibold"
                            : "border-border/60 bg-card hover:border-border hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Calendar className="size-6 mb-2.5 opacity-80" />
                        <span className="text-xs font-medium">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleScrollMonthsRight}
                  className="size-8 rounded-full border border-border/80 bg-background/90 shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground ml-2 shrink-0 cursor-pointer"
                  title="Xem thêm các tháng tiếp theo"
                >
                  <ChevronRight className="size-4" />
                </button>
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
