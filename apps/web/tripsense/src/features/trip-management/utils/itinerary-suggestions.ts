import type { ItineraryItemType } from "../types";
import { titleCaseDestination, tripCoverOptions } from "./format";
import { normalizeSearchText } from "./search";

export interface ItinerarySuggestion {
  title: string;
  type: ItineraryItemType;
  category: string;
  area: string;
  rating: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  imageUrl: string;
}

export function itinerarySuggestions(destination: string): ItinerarySuggestion[] {
  const normalized = normalizeSearchText(destination);
  const destinationName = titleCaseDestination(destination || "the city");

  if (normalized.includes("da nang")) {
    return [
      {
        title: "Nha hang Madame Lan",
        type: "MEAL",
        category: "Vietnamese",
        area: "Hai Chau, Da Nang Region",
        rating: "4.2",
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        notes: "Popular Vietnamese restaurant suggestion added manually.",
        imageUrl: tripCoverOptions[0],
      },
      {
        title: "Moc Quan Seafood",
        type: "MEAL",
        category: "Seafood",
        area: "An Hai Dong, Da Nang Region",
        rating: "4.6",
        startTime: "12:00",
        endTime: "13:30",
        durationMinutes: 90,
        notes: "Seafood meal idea added manually.",
        imageUrl: tripCoverOptions[1],
      },
      {
        title: "Van May",
        type: "MEAL",
        category: "Vietnamese",
        area: "My An, Da Nang",
        rating: "4.8",
        startTime: "18:00",
        endTime: "19:15",
        durationMinutes: 75,
        notes: "Vietnamese food stop added manually.",
        imageUrl: tripCoverOptions[2],
      },
    ];
  }

  return [
    {
      title: `${destinationName} local lunch`,
      type: "MEAL",
      category: "Restaurant",
      area: destinationName,
      rating: "4.5",
      startTime: "09:00",
      endTime: "10:30",
      durationMinutes: 90,
      notes: "Manual restaurant idea.",
      imageUrl: tripCoverOptions[0],
    },
    {
      title: `${destinationName} highlights walk`,
      type: "ACTIVITY",
      category: "Things to do",
      area: destinationName,
      rating: "4.7",
      startTime: "14:00",
      endTime: "16:00",
      durationMinutes: 120,
      notes: "Manual sightseeing idea.",
      imageUrl: tripCoverOptions[1],
    },
    {
      title: `${destinationName} coffee break`,
      type: "MEAL",
      category: "Cafe",
      area: destinationName,
      rating: "4.4",
      startTime: "16:30",
      endTime: "17:15",
      durationMinutes: 45,
      notes: "Manual cafe idea.",
      imageUrl: tripCoverOptions[2],
    },
  ];
}
