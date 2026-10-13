import type { ItineraryResponse, TripResponse } from "../types";

function formatIcsDate(isoDate: string): string {
  // Converts "2026-10-20" to "20261020"
  return isoDate.replace(/-/g, "");
}

function escapeIcsText(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function slugifyFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trip-itinerary"
  );
}

export function generateTripIcs(
  trip: TripResponse,
  itinerary?: ItineraryResponse | null,
): string {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TripSense//Travel Itinerary Planner//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(trip.name)}`,
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
  ];

  // 1. Overall Trip Master Event
  if (trip.startDate) {
    const startStr = formatIcsDate(trip.startDate);
    const endStr = trip.endDate ? formatIcsDate(trip.endDate) : startStr;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:ts-trip-${trip.id}@tripsense.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${startStr}`);
    lines.push(`DTEND;VALUE=DATE:${endStr}`);
    lines.push(`SUMMARY:${escapeIcsText(trip.name)}`);
    lines.push(`LOCATION:${escapeIcsText(trip.destinationName)}`);
    if (trip.notes) {
      lines.push(`DESCRIPTION:${escapeIcsText(trip.notes)}`);
    }
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  // 2. Individual Day Activity Events
  if (itinerary?.days && itinerary.days.length > 0) {
    const baseStartDate = trip.startDate ? new Date(trip.startDate) : null;

    itinerary.days.forEach((day, dayIndex) => {
      let dayDateStr = day.date;
      if (!dayDateStr && baseStartDate) {
        const computed = new Date(baseStartDate);
        computed.setDate(computed.getDate() + dayIndex);
        dayDateStr = computed.toISOString().slice(0, 10);
      }

      if (!dayDateStr) return;
      const formattedDayDate = formatIcsDate(dayDateStr);

      day.items.forEach((item, itemIndex) => {
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:ts-item-${item.id || `${day.id}-${itemIndex}`}@tripsense.app`);
        lines.push(`DTSTAMP:${now}`);

        // Handle time if available
        if (item.startTime && item.endTime && item.startTime.includes(":")) {
          const [sh, sm] = item.startTime.split(":");
          const [eh, em] = item.endTime.split(":");
          const startIso = `${formattedDayDate}T${sh.padStart(2, "0")}${sm.padStart(2, "0")}00`;
          const endIso = `${formattedDayDate}T${eh.padStart(2, "0")}${em.padStart(2, "0")}00`;
          lines.push(`DTSTART:${startIso}`);
          lines.push(`DTEND:${endIso}`);
        } else if (item.startTime && item.startTime.includes(":")) {
          const [sh, sm] = item.startTime.split(":");
          const startIso = `${formattedDayDate}T${sh.padStart(2, "0")}${sm.padStart(2, "0")}00`;
          lines.push(`DTSTART:${startIso}`);
          lines.push(`DTEND:${startIso}`);
        } else {
          // All-day activity on that day
          lines.push(`DTSTART;VALUE=DATE:${formattedDayDate}`);
          lines.push(`DTEND;VALUE=DATE:${formattedDayDate}`);
        }

        const titleText = item.title || item.placeNameSnapshot || "Hoạt động";
        lines.push(`SUMMARY:${escapeIcsText(titleText)}`);

        const locText = item.placeAddressSnapshot || item.placeNameSnapshot || trip.destinationName;
        if (locText) {
          lines.push(`LOCATION:${escapeIcsText(locText)}`);
        }

        const descParts = [
          item.notes,
        ].filter(Boolean);

        if (descParts.length > 0) {
          lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
        }

        lines.push("STATUS:CONFIRMED");
        lines.push("END:VEVENT");
      });
    });
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 specifies CRLF
  return lines.join("\r\n");
}

export function downloadTripIcs(
  trip: TripResponse,
  itinerary?: ItineraryResponse | null,
): void {
  const content = generateTripIcs(trip, itinerary);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(trip.name)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
