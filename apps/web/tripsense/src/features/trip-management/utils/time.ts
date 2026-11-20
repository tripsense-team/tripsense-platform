export function formatHHMM(timeStr?: string | null): string | null {
  if (!timeStr) return null;
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return timeStr;
}

export function durationMinutesFromTimeRange(
  startTime?: string | null,
  endTime?: string | null,
) {
  if (!startTime || !endTime) return null;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if (
    [startHour, startMinute, endHour, endMinute].some((part) =>
      Number.isNaN(part),
    )
  )
    return null;

  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal > startTotal ? endTotal - startTotal : null;
}

export function itemDurationMinutes(payload: {
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
}) {
  return (
    durationMinutesFromTimeRange(payload.startTime, payload.endTime) ??
    (payload.durationMinutes ? Number(payload.durationMinutes) : null)
  );
}

export function addMinutesToTime(
  startTime?: string | null,
  minutes?: number | null,
) {
  if (!startTime || minutes === null || minutes === undefined || minutes <= 0)
    return null;

  const [startHour, startMinute] = startTime.split(":").map(Number);
  if ([startHour, startMinute].some((part) => Number.isNaN(part))) return null;

  const nextTotal = startHour * 60 + startMinute + minutes;
  if (nextTotal >= 24 * 60) return "23:59";

  const hour = Math.floor(nextTotal / 60)
    .toString()
    .padStart(2, "0");
  const minute = (nextTotal % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function resolveItemEndTime(item: {
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
}): string | null {
  if (item.endTime) {
    return formatHHMM(item.endTime);
  }
  if (item.startTime) {
    const duration = itemDurationMinutes(item);
    if (duration && duration > 0) {
      const end = addMinutesToTime(item.startTime, duration);
      if (end) return end;
    }
    return formatHHMM(item.startTime);
  }
  return null;
}

export function chainItineraryItemsTimes<
  T extends {
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
  },
>(items: T[]): T[] {
  let previousEnd: string | null = null;
  return items.map((item, index) => {
    const duration = itemDurationMinutes(item);
    if (index === 0) {
      const end = resolveItemEndTime(item);
      previousEnd = end;
      if (item.startTime && duration && duration > 0 && end) {
        return {
          ...item,
          startTime: formatHHMM(item.startTime),
          endTime: end,
          durationMinutes: duration,
        };
      }
      return item;
    }

    if (!previousEnd) {
      previousEnd = resolveItemEndTime(item);
      return item;
    }

    if (!duration || duration <= 0) {
      const nextStart = previousEnd;
      const nextItem = {
        ...item,
        startTime: item.startTime ? nextStart : item.startTime,
      };
      previousEnd = resolveItemEndTime(nextItem);
      return nextItem;
    }

    const nextStart = previousEnd;
    const nextEnd = addMinutesToTime(nextStart, duration) || "23:59";
    previousEnd = nextEnd;
    return {
      ...item,
      startTime: nextStart,
      endTime: nextEnd,
      durationMinutes: duration,
    };
  });
}

export function chainItineraryResponse<
  T extends { days: Array<D> },
  D extends { items: Array<I> },
  I extends {
    startTime?: string | null;
    endTime?: string | null;
    durationMinutes?: number | null;
  },
>(itinerary: T | null): T | null {
  if (!itinerary) return null;
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      items: chainItineraryItemsTimes(day.items),
    })),
  };
}

export function formatDisplayTimeRange(
  startTime?: string | null,
  endTime?: string | null,
): string {
  const start = formatHHMM(startTime);
  const end = formatHHMM(endTime);
  if (start && end && start !== end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return start;
  }
  return "";
}

export const TIME_OPTIONS_24H = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
    .toString()
    .padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}).concat(["23:59"]);

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

export function isValidHHMM(timeStr?: string | null): boolean {
  if (!timeStr) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr.trim());
}

export function sortItineraryItemsByTime<
  T extends {
    id: string;
    startTime?: string | null;
    endTime?: string | null;
    sortOrder?: number | null;
  },
>(items: T[]): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      startMin: parseTimeToMinutes(item.startTime),
      endMin: parseTimeToMinutes(item.endTime),
    }))
    .sort((a, b) => {
      if (a.startMin !== null && b.startMin !== null && a.startMin !== b.startMin) {
        return a.startMin - b.startMin;
      }
      if (a.startMin !== null && b.startMin === null) return -1;
      if (a.startMin === null && b.startMin !== null) return 1;
      if (a.endMin !== null && b.endMin !== null && a.endMin !== b.endMin) {
        return a.endMin - b.endMin;
      }
      return (a.item.sortOrder ?? a.index) - (b.item.sortOrder ?? b.index);
    })
    .map((entry) => entry.item);
}

