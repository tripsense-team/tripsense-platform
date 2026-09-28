"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  areAllDaysIdentical,
  getTodayOpeningHours,
  parseOpeningHours,
} from "../utils/opening-hours";
import { cn } from "@/lib/utils";

interface OpeningHoursDisplayProps {
  openingHours?: string | null;
  businessStatus?: string | null;
  className?: string;
  defaultExpanded?: boolean;
}

export function OpeningHoursDisplay({
  openingHours,
  businessStatus,
  className,
  defaultExpanded = false,
}: OpeningHoursDisplayProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  if (!openingHours) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        {t("places.noOpeningHours", {
          defaultValue: "Chưa có thông tin giờ mở cửa",
        })}
      </div>
    );
  }

  const days = parseOpeningHours(openingHours);
  const isMultiDay = days.length > 1;
  const isIdenticalDaily = areAllDaysIdentical(days);
  const todayHours = getTodayOpeningHours(openingHours);

  return (
    <div className={cn("space-y-2 text-xs", className)}>
      {/* Header: Status badge & Today's hours */}
      <div className="flex flex-wrap items-center gap-2">
        {businessStatus === "OPERATIONAL" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {t("places.openNow", { defaultValue: "Đang mở cửa" })}
          </span>
        )}

        {businessStatus === "CLOSED_TEMPORARILY" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t("places.temporarilyClosed", { defaultValue: "Tạm đóng cửa" })}
          </span>
        )}

        {businessStatus === "CLOSED_PERMANENTLY" && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {t("places.permanentlyClosed", { defaultValue: "Đã đóng cửa" })}
          </span>
        )}

        {/* Primary summary text */}
        <span className="font-medium text-foreground/90 font-mono text-[13px]">
          {isIdenticalDaily && days[0] ? (
            <span>
              <span className="text-muted-foreground font-sans font-normal text-xs mr-1">
                {t("places.daily", { defaultValue: "Mỗi ngày" })}:
              </span>
              {days[0].hours}
            </span>
          ) : todayHours ? (
            <span>
              <span className="text-muted-foreground font-sans font-normal text-xs mr-1">
                {t("places.today", { defaultValue: "Hôm nay" })}:
              </span>
              {todayHours}
            </span>
          ) : (
            openingHours
          )}
        </span>

        {/* Toggle Schedule Button */}
        {isMultiDay && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors py-0.5 px-1.5 rounded-md hover:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {isExpanded
              ? t("places.hideWeeklySchedule", { defaultValue: "Thu gọn" })
              : t("places.viewWeeklySchedule", { defaultValue: "Xem cả tuần" })}
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Expanded Weekly Schedule Table */}
      {isMultiDay && isExpanded && (
        <div className="rounded-xl border border-border/50 bg-muted/30 p-2 space-y-0.5 animate-in fade-in-50 duration-150">
          {days.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center justify-between px-2.5 py-1 rounded-lg text-xs transition-colors",
                item.isToday
                  ? "bg-primary/10 font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={item.isToday ? "text-foreground font-semibold" : "text-muted-foreground"}>
                  {item.day || openingHours}
                </span>
                {item.isToday && (
                  <span className="text-micro font-bold tracking-wider text-primary px-1.5 py-0.5 rounded-full bg-primary/15 uppercase">
                    {t("places.today", { defaultValue: "Hôm nay" })}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "font-mono text-[11.5px] tabular-nums",
                  item.isToday ? "text-primary font-bold" : "text-foreground/80 font-normal"
                )}
              >
                {item.hours}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
