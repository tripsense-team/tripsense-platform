export type PreferenceStepDefinition = {
  dimension: string;
  single?: boolean;
  options: readonly string[];
};

export const PREFERENCE_STEPS: readonly PreferenceStepDefinition[] = [
  {
    dimension: "TRAVEL_PARTY",
    single: true,
    options: ["SOLO", "COUPLE", "FRIENDS", "FAMILY"],
  },
  {
    dimension: "BUDGET_TIER",
    single: true,
    options: ["BUDGET", "MID_RANGE", "PREMIUM"],
  },
  {
    dimension: "STAY_STYLE",
    options: ["HOTEL", "HOMESTAY", "RESORT", "HOSTEL"],
  },
  {
    dimension: "FOOD_STYLE",
    options: ["LOCAL_FOOD", "STREET_FOOD", "FINE_DINING", "CAFE"],
  },
  {
    dimension: "ACTIVITY_INTEREST",
    options: ["NATURE", "HIKING", "CULTURE", "BEACH", "NIGHTLIFE"],
  },
];

export interface CuratedDestination {
  id: string;
  name: string;
  flag?: string;
  region?: string;
}

export const POPULAR_DESTINATIONS: readonly CuratedDestination[] = [
  // Vietnam destinations
  { id: "da-nang", name: "Đà Nẵng", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-lat", name: "Đà Lạt", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-noi", name: "Hà Nội", flag: "🇻🇳", region: "Vietnam" },
  { id: "ho-chi-minh", name: "TP. Hồ Chí Minh", flag: "🇻🇳", region: "Vietnam" },
  { id: "phu-quoc", name: "Phú Quốc", flag: "🇻🇳", region: "Vietnam" },
  { id: "hoi-an", name: "Hội An", flag: "🇻🇳", region: "Vietnam" },
  { id: "nha-trang", name: "Nha Trang", flag: "🇻🇳", region: "Vietnam" },
  { id: "sapa", name: "Sa Pa", flag: "🇻🇳", region: "Vietnam" },
  { id: "ninh-binh", name: "Ninh Bình", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-giang", name: "Hà Giang", flag: "🇻🇳", region: "Vietnam" },
  { id: "hue", name: "Huế", flag: "🇻🇳", region: "Vietnam" },
  { id: "quy-nhon", name: "Quy Nhơn", flag: "🇻🇳", region: "Vietnam" },
  { id: "vung-tau", name: "Vũng Tàu", flag: "🇻🇳", region: "Vietnam" },
  { id: "phong-nha", name: "Phong Nha", flag: "🇻🇳", region: "Vietnam" },
  { id: "can-tho", name: "Cần Thơ", flag: "🇻🇳", region: "Vietnam" },
  // International / Regional favorites
  { id: "bangkok", name: "Bangkok", flag: "🇹🇭", region: "Asia" },
  { id: "tokyo", name: "Tokyo", flag: "🇯🇵", region: "Asia" },
  { id: "singapore", name: "Singapore", flag: "🇸🇬", region: "Asia" },
  { id: "seoul", name: "Seoul", flag: "🇰🇷", region: "Asia" },
  { id: "bali", name: "Bali", flag: "🇮🇩", region: "Asia" },
  { id: "taipei", name: "Taipei", flag: "🇹🇼", region: "Asia" },
];

export const POPULAR_HOME_CITIES: readonly CuratedDestination[] = [
  { id: "ho-chi-minh", name: "TP. Hồ Chí Minh", flag: "🇻🇳", region: "Vietnam" },
  { id: "ha-noi", name: "Hà Nội", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-nang", name: "Đà Nẵng", flag: "🇻🇳", region: "Vietnam" },
  { id: "can-tho", name: "Cần Thơ", flag: "🇻🇳", region: "Vietnam" },
  { id: "hai-phong", name: "Hải Phòng", flag: "🇻🇳", region: "Vietnam" },
  { id: "nha-trang", name: "Nha Trang", flag: "🇻🇳", region: "Vietnam" },
  { id: "hue", name: "Huế", flag: "🇻🇳", region: "Vietnam" },
  { id: "da-lat", name: "Đà Lạt", flag: "🇻🇳", region: "Vietnam" },
  { id: "quy-nhon", name: "Quy Nhơn", flag: "🇻🇳", region: "Vietnam" },
  { id: "vung-tau", name: "Vũng Tàu", flag: "🇻🇳", region: "Vietnam" },
];

export const QUICK_FREE_TEXT_TAGS = [
  { key: "quickTagPhoto", icon: "📸" },
  { key: "quickTagCafe", icon: "☕" },
  { key: "quickTagNature", icon: "🌲" },
  { key: "quickTagBeach", icon: "🏖️" },
  { key: "quickTagTrek", icon: "🥾" },
  { key: "quickTagVegetarian", icon: "🥗" },
];

export function toPlaceRef(name: string): string {
  return name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function toOptionCode(name: string): string {
  const code = name
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase()
    .slice(0, 80);
  return code || "CUSTOM";
}
