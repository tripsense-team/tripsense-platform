export function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a Date object as a local ISO date string (YYYY-MM-DD),
 * avoiding timezone offset shifts caused by .toISOString().
 */
export function formatLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ENGLISH_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function inferYear(targetMonth: number, baseDate: Date): number {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1; // 1-12
  if (targetMonth < currentMonth) {
    return currentYear + 1;
  }
  return currentYear;
}

function getSafeStartDateInMonth(year: number, month: number, baseDate: Date): Date {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  const currentDay = baseDate.getDate();

  // If in current month, ensure start date is not in the past
  if (year === currentYear && month === currentMonth) {
    const proposed = new Date(year, month - 1, currentDay + 3);
    if (proposed.getMonth() + 1 === month) {
      return proposed;
    }
    return new Date(year, month - 1, currentDay);
  }

  // Future month: start on the 1st of that month
  return new Date(year, month - 1, 1);
}

/**
 * Parses a flexible month string (e.g. "Tháng 12", "Tháng 1", "2026-12", "Dec 2026")
 * into a Date representing the target start date in that month.
 */
export function parseFlexibleMonth(monthStr: string, baseDate: Date = new Date()): Date | null {
  if (!monthStr || typeof monthStr !== "string") return null;
  const trimmed = monthStr.trim();

  // Pattern 1: YYYY-MM (e.g. "2026-12")
  const yyyyMm = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyyMm) {
    const year = parseInt(yyyyMm[1], 10);
    const month = parseInt(yyyyMm[2], 10);
    if (month >= 1 && month <= 12) {
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  // Pattern 2: "Tháng X/YYYY" or "Tháng X YYYY" or "X/YYYY"
  const monthWithYear = trimmed.match(/(?:tháng\s*|t\s*)?(\d{1,2})[\s/]+(\d{4})/i);
  if (monthWithYear) {
    const month = parseInt(monthWithYear[1], 10);
    const year = parseInt(monthWithYear[2], 10);
    if (month >= 1 && month <= 12) {
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  // Pattern 3: English month name with optional year (e.g. "December 2026", "Dec 2026", "December")
  const englishMatch = trimmed.match(/([a-zA-Z]{3,9})(?:\s+(\d{4}))?/i);
  if (englishMatch) {
    const mName = englishMatch[1].toLowerCase();
    const mNum = ENGLISH_MONTHS[mName];
    if (mNum) {
      const explicitYear = englishMatch[2] ? parseInt(englishMatch[2], 10) : undefined;
      const year = explicitYear ?? inferYear(mNum, baseDate);
      return getSafeStartDateInMonth(year, mNum, baseDate);
    }
  }

  // Pattern 4: "Tháng X" or "X" (e.g. "Tháng 12", "Tháng 1", "12")
  const vnMatch = trimmed.match(/(?:tháng\s*|t\s*)?(\d{1,2})/i);
  if (vnMatch) {
    const month = parseInt(vnMatch[1], 10);
    if (month >= 1 && month <= 12) {
      const year = inferYear(month, baseDate);
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  return null;
}

/**
 * Resolves a flexible selection into concrete start and end dates (YYYY-MM-DD).
 */
export function resolveFlexibleDates(
  durationDays: number = 3,
  flexibleMonths?: string[],
  baseDate: Date = new Date()
): { startDate: string; endDate: string } {
  const safeDuration = Math.max(1, durationDays);

  if (flexibleMonths && flexibleMonths.length > 0) {
    for (const monthStr of flexibleMonths) {
      const parsed = parseFlexibleMonth(monthStr, baseDate);
      if (parsed) {
        const start = parsed;
        const end = new Date(start);
        end.setDate(end.getDate() + safeDuration - 1);
        return {
          startDate: formatLocalDateIso(start),
          endDate: formatLocalDateIso(end),
        };
      }
    }
  }

  // Default fallback: 7 days from baseDate
  const start = new Date(baseDate);
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + safeDuration - 1);
  return {
    startDate: formatLocalDateIso(start),
    endDate: formatLocalDateIso(end),
  };
}

/**
 * Checks if a given date string (YYYY-MM-DD) falls within the flexible month.
 */
export function isDateInFlexibleMonth(
  dateStr: string,
  monthStr: string,
  baseDate: Date = new Date()
): boolean {
  if (!dateStr || !monthStr) return false;
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    const parsed = parseFlexibleMonth(monthStr, baseDate);
    if (!parsed) return false;
    return d.getFullYear() === parsed.getFullYear() && d.getMonth() === parsed.getMonth();
  } catch {
    return false;
  }
}

/**
 * Formats a when selection into a human-readable string based on locale.
 */
export function formatWhenSelection({
  type,
  startDate,
  endDate,
  durationDays,
  flexibleMonths,
  locale = "vi",
}: {
  type?: "dates" | "flexible";
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  flexibleMonths?: string[];
  locale?: string;
}): string {
  if (type === "flexible" || (!startDate && durationDays)) {
    const days = durationDays || 3;
    const daysText = locale === "vi" ? `${days} ngày` : `${days} day${days > 1 ? "s" : ""}`;
    if (flexibleMonths && flexibleMonths.length > 0) {
      const monthsText = flexibleMonths.join(", ");
      return locale === "vi"
        ? `${daysText} trong ${monthsText}`
        : `${daysText} in ${monthsText}`;
    }
    return locale === "vi" ? `${daysText} (Linh hoạt)` : `${daysText} (Flexible)`;
  }

  if (startDate && endDate) {
    try {
      const s = new Date(startDate.includes("T") ? startDate : `${startDate}T00:00:00`);
      const e = new Date(endDate.includes("T") ? endDate : `${endDate}T00:00:00`);
      const sMonth = s.getMonth() + 1;
      const eMonth = e.getMonth() + 1;
      if (locale === "vi") {
        if (sMonth === eMonth) {
          return `${s.getDate()} – ${e.getDate()} thg ${sMonth}`;
        }
        return `${s.getDate()} thg ${sMonth} – ${e.getDate()} thg ${eMonth}`;
      }
      const sMonthStr = s.toLocaleString("en-US", { month: "short" });
      const eMonthStr = e.toLocaleString("en-US", { month: "short" });
      if (sMonth === eMonth) {
        return `${sMonthStr} ${s.getDate()} – ${e.getDate()}`;
      }
      return `${sMonthStr} ${s.getDate()} – ${eMonthStr} ${e.getDate()}`;
    } catch {
      return `${startDate} → ${endDate}`;
    }
  }

  if (startDate) return startDate;
  return locale === "vi" ? "Chọn thời gian" : "Select dates";
}

/**
 * Extracts flexible preference from a trip's notes field, if present.
 * Format generated by AI Planner: "Travel preference: 2 days flexible (Tháng 11)"
 */
export function parseFlexiblePreferenceFromNotes(notes?: string | null): {
  durationDays: number;
  flexibleMonths?: string[];
} | null {
  if (!notes || typeof notes !== "string") return null;
  const match = notes.match(/Travel preference:\s*(\d+)\s*days\s*flexible(?:\s*\(([^)]+)\))?/i);
  if (!match) return null;
  const durationDays = parseInt(match[1], 10);
  if (Number.isNaN(durationDays) || durationDays <= 0) return null;
  const monthsStr = match[2];
  const flexibleMonths = monthsStr
    ? monthsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return { durationDays, flexibleMonths };
}

