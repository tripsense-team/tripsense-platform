"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
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
};

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function WhenModal({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  onSave,
}: WhenModalProps) {
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

  // Helper to render month days grid
  const renderMonthCalendar = (monthDate: Date, showPrevArrow: boolean, showNextArrow: boolean) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const startDateGrid = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start (CN)
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
            {format(monthDate, "MMMM yyyy")}
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
          {DAY_LABELS.map((label) => (
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
                      ? "bg-black text-white dark:bg-white dark:text-black font-semibold shadow-xs"
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
      title="When"
      maxWidth="max-w-2xl"
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
                  ? "bg-white dark:bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Dates
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flexible")}
              className={`rounded-full px-5 py-1.5 font-semibold transition-all cursor-pointer ${
                activeTab === "flexible"
                  ? "bg-white dark:bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Flexible
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
                Stay for how long?
              </h4>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { id: "weekend", label: "Weekend" },
                  { id: "1week", label: "A week" },
                  { id: "1month", label: "A month" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFlexiblePeriod(item.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      flexiblePeriod === item.id
                        ? "bg-black text-white dark:bg-white dark:text-black border-transparent shadow-xs"
                        : "border-border/80 bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 text-center">
                Go anytime
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-w-md mx-auto">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const m = addMonths(today, idx);
                  const mKey = format(m, "yyyy-MM");
                  const isSelected = selectedMonths.includes(mKey);

                  return (
                    <button
                      key={mKey}
                      type="button"
                      onClick={() => {
                        setSelectedMonths((prev) =>
                          isSelected
                            ? prev.filter((k) => k !== mKey)
                            : [...prev, mKey]
                        );
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-black bg-neutral-100 dark:border-white dark:bg-neutral-800"
                          : "border-border/60 hover:border-foreground/40 bg-card"
                      }`}
                    >
                      <CalendarIcon className="size-4 mb-1 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">
                        {format(m, "MMM")}
                      </span>
                      <span className="text-micro text-muted-foreground">
                        {format(m, "yyyy")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer: Update button aligned to right matching Mindtrip screenshot */}
        <div className="flex justify-end pt-4 border-t border-border/40">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-black hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-8 py-2.5 text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            Update
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
