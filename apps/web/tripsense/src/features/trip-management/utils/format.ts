import type { DisplayStatus, ItineraryItemType, TripResponse } from "../types";

export const tripCoverOptions = [
  "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&auto=format&fit=crop&q=80",
];

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(start);
  const endText = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end);
  return `${startText} - ${endText}`;
}

export function formatShortRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(start);
  const endText = new Intl.DateTimeFormat("en", {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  }).format(end);
  return `${startText} - ${endText}`;
}

export function countTripDays(trip: TripResponse): number {
  return Math.max(
    1,
    Math.round(
      (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) /
        86400000,
    ) + 1,
  );
}

const destinationCovers: Record<string, string[]> = {
  danang: [
    "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&auto=format&fit=crop&q=80", // Golden Bridge Da Nang
    "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&auto=format&fit=crop&q=80", // My Khe Beach
    "https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80", // Da Nang Bay
  ],
  hanoi: [
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&auto=format&fit=crop&q=80",
  ],
  hoian: [
    "https://images.unsplash.com/photo-1555921015-5532091f6026?w=1200&auto=format&fit=crop&q=80",
  ],
  dalat: [
    "https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=1200&auto=format&fit=crop&q=80",
  ],
  saigon: [
    "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&auto=format&fit=crop&q=80",
  ],
  phuquoc: [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&auto=format&fit=crop&q=80",
  ],
};

function getDestinationKey(dest: string, name: string): string | null {
  const combined = (dest + " " + name).toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (combined.includes("da nang")) return "danang";
  if (combined.includes("ha noi")) return "hanoi";
  if (combined.includes("hoi an")) return "hoian";
  if (combined.includes("da lat")) return "dalat";
  if (combined.includes("sai gon") || combined.includes("ho chi minh")) return "saigon";
  if (combined.includes("phu quoc")) return "phuquoc";
  return null;
}

export function coverImageForTrip(trip: TripResponse): string {
  if (trip.coverImageUrl) {
    return trip.coverImageUrl;
  }

  const destKey = getDestinationKey(trip.destinationName, trip.name);
  const options = destKey && destinationCovers[destKey] ? destinationCovers[destKey] : tripCoverOptions;

  const idStr = trip.id || "trip";
  const index =
    [...idStr].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    options.length;
  return options[index];
}

export function displayStatusLabel(status: DisplayStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function displayTripTitle(trip: TripResponse): string {
  const name = trip.name.trim();
  return name || `Trip to ${titleCaseDestination(trip.destinationName)}`;
}

export function itemTypeLabel(type: ItineraryItemType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function titleCaseDestination(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toLocaleUpperCase("vi-VN") + word.slice(1))
    .join(" ");
}

export function tripTimingPhrase(trip: TripResponse): string {
  const start = new Date(trip.startDate);
  const day = start.getDate();
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(start);

  if (day >= 24) return `at the end of ${month}`;
  if (day <= 7) return `at the beginning of ${month}`;
  return `in the middle of ${month}`;
}
