/**
 * Format conversation timestamp for chat sidebar / list items (Messenger style).
 * Handles raw ISO 8601 strings (e.g. "2026-09-24T19:41:54.117128Z"), millisecond timestamps,
 * and preserves pre-formatted mock strings gracefully.
 */
export function formatConversationTime(
  dateStrOrTimestamp?: string | number | null,
  locale: string = "vi"
): string {
  if (!dateStrOrTimestamp && dateStrOrTimestamp !== 0) return "";

  let date: Date | null = null;

  if (typeof dateStrOrTimestamp === "number") {
    if (!isNaN(dateStrOrTimestamp) && dateStrOrTimestamp > 0) {
      date = new Date(dateStrOrTimestamp);
    }
  } else if (typeof dateStrOrTimestamp === "string") {
    const raw = dateStrOrTimestamp.trim();
    if (!raw) return "";

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    } else {
      // Not a parseable date -> return raw string (e.g. mock strings "10:20", "Hôm qua")
      return raw;
    }
  }

  if (!date || isNaN(date.getTime())) {
    return typeof dateStrOrTimestamp === "string" ? dateStrOrTimestamp : "";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const isEn = locale === "en";

  // 1. Sent within the last minute
  if (diffMinutes < 1 && diffMs >= -60000) {
    return isEn ? "Just now" : "Vừa xong";
  }

  // 2. Sent today (same calendar day in user's local timezone)
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  // 3. Sent yesterday
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return isEn ? "Yesterday" : "Hôm qua";
  }

  // 4. Sent within the last 7 calendar days -> Weekday abbreviation
  const midnightToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const midnightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (midnightToday.getTime() - midnightDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDifference > 0 && dayDifference < 7) {
    const viDays = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    const enDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return isEn ? enDays[date.getDay()] : viDays[date.getDay()];
  }

  // 5. Older: same year -> dd/MM
  const isSameYear = date.getFullYear() === now.getFullYear();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  if (isSameYear) {
    return `${day}/${month}`;
  }

  // 6. Different year -> dd/MM/yyyy
  return `${day}/${month}/${date.getFullYear()}`;
}
