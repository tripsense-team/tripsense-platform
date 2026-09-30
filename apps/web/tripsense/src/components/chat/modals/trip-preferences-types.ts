export type TripPreferences = {
  where?: {
    location: string;
    isRoadTrip: boolean;
  };
  when?: {
    type: "dates" | "flexible";
    startDate?: string; // YYYY-MM-DD
    endDate?: string;   // YYYY-MM-DD
    flexiblePeriod?: string; // e.g. "weekend", "1week", "1month"
    flexibleMonths?: string[];
  };
  who?: {
    adults: number;
    children: number;
    infants: number;
    pets: number;
  };
  budget?:
    | "any"
    | "budget"
    | "sensible"
    | "upscale"
    | "luxury"
    | { mode: "FLEXIBLE" }
    | { mode: "TOTAL"; amount: number; currency: string };
};

export type ActiveModalType = "where" | "when" | "who" | "budget" | null;
