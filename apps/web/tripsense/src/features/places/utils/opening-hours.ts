export interface OpeningHoursDay {
  day: string;
  hours: string;
  isToday: boolean;
}

const DAY_KEYWORDS: Record<number, string[]> = {
  0: ["chủ nhật", "chu nhat", "sunday", "sun"],
  1: ["thứ hai", "thu hai", "thứ 2", "thu 2", "monday", "mon"],
  2: ["thứ ba", "thu ba", "thứ 3", "thu 3", "tuesday", "tue"],
  3: ["thứ tư", "thu tu", "thứ 4", "thu 4", "wednesday", "wed"],
  4: ["thứ năm", "thu nam", "thứ 5", "thu 5", "thursday", "thu"],
  5: ["thứ sáu", "thu sau", "thứ 6", "thu 6", "friday", "fri"],
  6: ["thứ bảy", "thu bay", "thứ 7", "thu 7", "saturday", "sat"],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isDayOfWeek(dayName: string, targetDay: number): boolean {
  const normalized = normalizeText(dayName);
  const keywords = DAY_KEYWORDS[targetDay] || [];
  return keywords.some((kw) => normalized.includes(normalizeText(kw)));
}

export function parseOpeningHours(
  raw?: string | null,
  currentDayOfWeek: number = new Date().getDay()
): OpeningHoursDay[] {
  if (!raw || !raw.trim()) return [];

  const separator = raw.includes(";") ? ";" : raw.includes("\n") ? "\n" : null;
  if (!separator) {
    return [
      {
        day: "",
        hours: raw.trim(),
        isToday: true,
      },
    ];
  }

  return raw
    .split(separator)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        const day = line.substring(0, colonIndex).trim();
        const hours = line.substring(colonIndex + 1).trim();
        const isToday = isDayOfWeek(day, currentDayOfWeek);
        return { day, hours, isToday };
      }
      return { day: "", hours: line, isToday: false };
    });
}

export function getTodayOpeningHours(
  raw?: string | null,
  currentDayOfWeek: number = new Date().getDay()
): string | null {
  const parsed = parseOpeningHours(raw, currentDayOfWeek);
  if (parsed.length === 0) return null;
  if (parsed.length === 1 && !parsed[0].day) return parsed[0].hours;

  const today = parsed.find((d) => d.isToday);
  if (today) return today.hours;

  return parsed[0].hours;
}

export function areAllDaysIdentical(days: OpeningHoursDay[]): boolean {
  if (days.length <= 1) return false;
  const firstHours = days[0].hours;
  return days.every((d) => d.hours === firstHours && Boolean(d.hours));
}
