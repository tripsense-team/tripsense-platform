export type DestinationRegion = "all" | "vietnam" | "asia" | "world";

export type PopularDestination = {
  id: string;
  name: string;
  country: string;
  region: "vietnam" | "asia" | "world";
  flag: string;
  landmark: string;
  image: string;
  keywords?: string[];
};

export const POPULAR_DESTINATIONS: readonly PopularDestination[] = [
  // 1. Singapore (User specifically requested)
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    region: "asia",
    flag: "🇸🇬",
    landmark: "Marina Bay Sands & Merlion",
    image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&auto=format&fit=crop&q=80",
    keywords: ["sing", "singapore", "dao quoc su tu", "marina"],
  },
  // 2. Kuala Lumpur (User specifically requested)
  {
    id: "kuala-lumpur",
    name: "Kuala Lumpur",
    country: "Malaysia",
    region: "asia",
    flag: "🇲🇾",
    landmark: "Petronas Twin Towers & Batu Caves",
    image: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=400&auto=format&fit=crop&q=80",
    keywords: ["kualalumpur", "kuala lumpur", "kl", "malaysia", "petronas"],
  },
  // 3. New York (User specifically requested)
  {
    id: "new-york",
    name: "New York",
    country: "Hoa Kỳ",
    region: "world",
    flag: "🇺🇸",
    landmark: "Statue of Liberty & Times Square",
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&auto=format&fit=crop&q=80",
    keywords: ["newyork", "new york", "nyc", "my", "usa", "manhattan"],
  },
  // 4. Đà Nẵng (User specifically requested)
  {
    id: "da-nang",
    name: "Đà Nẵng",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Cầu Rồng & Cầu Vàng Bà Nà Hills",
    image: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=400&auto=format&fit=crop&q=80",
    keywords: ["da nang", "danang", "ba na", "my khe", "son tra"],
  },
  // 5. Hà Nội (User specifically requested)
  {
    id: "ha-noi",
    name: "Hà Nội",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Hồ Hoàn Kiếm & 36 Phố Phường",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&auto=format&fit=crop&q=80",
    keywords: ["ha noi", "hanoi", "ho guom", "thap rua", "pho co"],
  },
  // 6. TP. Hồ Chí Minh
  {
    id: "ho-chi-minh",
    name: "TP. Hồ Chí Minh",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Landmark 81 & Chợ Bến Thành",
    image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&auto=format&fit=crop&q=80",
    keywords: ["sai gon", "saigon", "ho chi minh", "tphcm", "ben thanh"],
  },
  // 7. Đà Lạt
  {
    id: "da-lat",
    name: "Đà Lạt",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Quảng trường Lâm Viên & Hồ Xuân Hương",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80",
    keywords: ["da lat", "dalat", "lam vien", "thanh pho suong mu"],
  },
  // 8. Phú Quốc
  {
    id: "phu-quoc",
    name: "Phú Quốc",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Đảo Ngọc & Cáp treo Hòn Thơm",
    image: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=400&auto=format&fit=crop&q=80",
    keywords: ["phu quoc", "phuquoc", "dao ngoc", "hon thom", "bai sao"],
  },
  // 9. Hội An
  {
    id: "hoi-an",
    name: "Hội An",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Phố cổ đèn lồng & Chùa Cầu",
    image: "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=400&auto=format&fit=crop&q=80",
    keywords: ["hoi an", "hoian", "chua cau", "song hoai", "pho co"],
  },
  // 10. Nha Trang
  {
    id: "nha-trang",
    name: "Nha Trang",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Vịnh biển & Tháp Bà Ponagar",
    image: "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&auto=format&fit=crop&q=80",
    keywords: ["nha trang", "nhatrang", "vinwonders", "hon mun"],
  },
  // 11. Sa Pa
  {
    id: "sa-pa",
    name: "Sa Pa",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Đỉnh Fansipan & Bản Cát Cát",
    image: "https://images.unsplash.com/photo-1528127269322-539801943592?w=400&auto=format&fit=crop&q=80",
    keywords: ["sa pa", "sapa", "fansipan", "cat cat", "ruong bac thang"],
  },
  // 12. Hạ Long
  {
    id: "ha-long",
    name: "Hạ Long",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Vịnh Hạ Long & Đảo Ti Tốp",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80",
    keywords: ["ha long", "halong", "vinh ha long", "quang ninh"],
  },
  // 13. Huế
  {
    id: "hue",
    name: "Huế",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Đại Nội Cố Đô & Sông Hương",
    image: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=400&auto=format&fit=crop&q=80",
    keywords: ["hue", "dai noi", "thien mu", "co do"],
  },
  // 14. Ninh Bình
  {
    id: "ninh-binh",
    name: "Ninh Bình",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Tràng An & Hang Múa",
    image: "https://images.unsplash.com/photo-1576487248805-cf45f6bcc67f?w=400&auto=format&fit=crop&q=80",
    keywords: ["ninh binh", "ninhbinh", "trang an", "tam coc", "bai dinh"],
  },
  // 15. Quy Nhơn
  {
    id: "quy-nhon",
    name: "Quy Nhơn",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Kỳ Co, Eo Gió & Ghềnh Ráng",
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80",
    keywords: ["quy nhon", "quynhon", "ky co", "eo gio", "binh dinh"],
  },
  // 16. Vũng Tàu
  {
    id: "vung-tau",
    name: "Vũng Tàu",
    country: "Việt Nam",
    region: "vietnam",
    flag: "🇻🇳",
    landmark: "Bãi Sau & Mũi Nghinh Phong",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80",
    keywords: ["vung tau", "vungtau", "bai sau", "bai truoc"],
  },
  // 17. Bangkok
  {
    id: "bangkok",
    name: "Bangkok",
    country: "Thái Lan",
    region: "asia",
    flag: "🇹🇭",
    landmark: "Wat Arun & Hoàng Cung Grand Palace",
    image: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&auto=format&fit=crop&q=80",
    keywords: ["bangkok", "thai lan", "thailand", "wat arun", "siam"],
  },
  // 18. Tokyo
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Nhật Bản",
    region: "asia",
    flag: "🇯🇵",
    landmark: "Tokyo Tower & Ngã tư Shibuya",
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&auto=format&fit=crop&q=80",
    keywords: ["tokyo", "nhat ban", "japan", "shibuya", "shinjuku"],
  },
  // 19. Seoul
  {
    id: "seoul",
    name: "Seoul",
    country: "Hàn Quốc",
    region: "asia",
    flag: "🇰🇷",
    landmark: "Tháp N Seoul & Cung Gyeongbokgung",
    image: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&auto=format&fit=crop&q=80",
    keywords: ["seoul", "han quoc", "korea", "myeongdong", "gangnam"],
  },
  // 20. Bali
  {
    id: "bali",
    name: "Bali",
    country: "Indonesia",
    region: "asia",
    flag: "🇮🇩",
    landmark: "Đền Ulun Danu & Bãi biển Kuta",
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&auto=format&fit=crop&q=80",
    keywords: ["bali", "indonesia", "ubud", "kuta"],
  },
  // 21. Taipei
  {
    id: "taipei",
    name: "Taipei",
    country: "Đài Loan",
    region: "asia",
    flag: "🇹🇼",
    landmark: "Taipei 101 & Chợ đêm Shilin",
    image: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&auto=format&fit=crop&q=80",
    keywords: ["taipei", "dai bac", "dai loan", "taiwan"],
  },
  // 22. Hong Kong
  {
    id: "hong-kong",
    name: "Hong Kong",
    country: "Hồng Kông",
    region: "asia",
    flag: "🇭🇰",
    landmark: "Cảng Victoria & Đỉnh Victoria Peak",
    image: "https://images.unsplash.com/photo-1506970845246-18f21d533b20?w=400&auto=format&fit=crop&q=80",
    keywords: ["hong kong", "hongkong", "hong kong", "victoria peak"],
  },
  // 23. Paris
  {
    id: "paris",
    name: "Paris",
    country: "Pháp",
    region: "world",
    flag: "🇫🇷",
    landmark: "Tháp Eiffel & Bảo tàng Louvre",
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&auto=format&fit=crop&q=80",
    keywords: ["paris", "phap", "france", "eiffel", "louvre"],
  },
  // 24. London
  {
    id: "london",
    name: "London",
    country: "Vương quốc Anh",
    region: "world",
    flag: "🇬🇧",
    landmark: "Big Ben & Cầu Tháp Tower Bridge",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&auto=format&fit=crop&q=80",
    keywords: ["london", "anh", "uk", "england", "big ben"],
  },
  // 25. Rome
  {
    id: "rome",
    name: "Rome",
    country: "Ý",
    region: "world",
    flag: "🇮🇹",
    landmark: "Đấu trường La Mã Colosseum",
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&auto=format&fit=crop&q=80",
    keywords: ["rome", "roma", "y", "italy", "colosseum"],
  },
  // 26. Sydney
  {
    id: "sydney",
    name: "Sydney",
    country: "Úc",
    region: "world",
    flag: "🇦🇺",
    landmark: "Nhà hát Opera Sydney & Cầu Cảng",
    image: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&auto=format&fit=crop&q=80",
    keywords: ["sydney", "uc", "australia", "opera house"],
  },
  // 27. Dubai
  {
    id: "dubai",
    name: "Dubai",
    country: "UAE",
    region: "world",
    flag: "🇦🇪",
    landmark: "Tòa tháp Burj Khalifa & Đảo Cọ",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&auto=format&fit=crop&q=80",
    keywords: ["dubai", "uae", "burj khalifa"],
  },
];

/**
 * Normalizes string for accent/case-insensitive matching (e.g., 'da nang' -> 'da nang', 'Đà Nẵng' -> 'da nang')
 */
export function normalizeDestinationText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filters the curated list of famous destinations by query and region
 */
export function filterDestinations(
  query: string,
  region: DestinationRegion = "all",
  destinations: readonly PopularDestination[] = POPULAR_DESTINATIONS,
): PopularDestination[] {
  const normQuery = normalizeDestinationText(query);
  const compactQuery = normQuery.replace(/\s+/g, "");

  return destinations.filter((dest) => {
    // 1. Region filter
    if (region !== "all" && dest.region !== region) {
      return false;
    }

    // 2. Text query filter
    if (!normQuery) return true;

    const normName = normalizeDestinationText(dest.name);
    const compactName = normName.replace(/\s+/g, "");
    const normCountry = normalizeDestinationText(dest.country);
    const normLandmark = normalizeDestinationText(dest.landmark);

    if (
      normName.includes(normQuery) ||
      compactName.includes(compactQuery) ||
      normCountry.includes(normQuery) ||
      normLandmark.includes(normQuery)
    ) {
      return true;
    }

    if (dest.keywords?.some((k) => normalizeDestinationText(k).includes(normQuery))) {
      return true;
    }

    return false;
  });
}
