import { tool } from "ai";
import { z } from "zod";
import { config } from "../../config.js";

export interface PlaceSearchResult {
  id: string;
  name: string;
  address?: string;
  city?: string;
  categories: string[];
  location?: { lat: number; lng: number };
  photoUrl?: string;
  rating?: number;
  phone?: string;
}

export const searchPlaces = tool({
  description:
    "Tìm kiếm địa điểm du lịch, ẩm thực, quán cafe, khách sạn, điểm check-in có thật trong hệ thống TripSense.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Từ khoá tìm kiếm, ví dụ: 'hải sản Mỹ Khê', 'cafe view biển Đà Nẵng', 'khách sạn gần phố cổ', 'bún chả Hà Nội'"
      ),
    category: z
      .enum(["FOOD", "CAFE", "STAY", "ATTRACTION"])
      .optional()
      .describe("Phân loại địa điểm: FOOD (ẩm thực), CAFE (cà phê), STAY (khách sạn/homestay), ATTRACTION (điểm tham quan)"),
    limit: z
      .number()
      .default(5)
      .describe("Số lượng địa điểm tối đa cần lấy (1 đến 10)"),
    lat: z.number().optional().describe("Vĩ độ toạ độ nếu tìm quanh vị trí cụ thể"),
    lng: z.number().optional().describe("Kinh độ toạ độ nếu tìm quanh vị trí cụ thể"),
  }),
  execute: async ({ query, category, limit, lat, lng }) => {
    try {
      const safeLimit = Math.min(Math.max(limit || 5, 1), 10);
      const url = new URL(`${config.placeServiceUrl}/api/places/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(safeLimit));

      if (category) {
        url.searchParams.set("category", category);
      }
      if (lat !== undefined && lng !== undefined) {
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lng", String(lng));
      }

      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        return {
          success: false,
          errorCode: "PLACE_SEARCH_UNAVAILABLE",
          places: [],
        };
      }

      const json = await res.json();
      const rawPlaces = Array.isArray(json.data) ? json.data : [];

      const places: PlaceSearchResult[] = rawPlaces.flatMap((p: any) => {
        if (typeof p.id !== "string" || !p.id.trim()) return [];
        let photoUrl: string | undefined;
        if (Array.isArray(p.photos) && p.photos.length > 0) {
          photoUrl = p.photos[0]?.url || p.photos[0];
        } else if (Array.isArray(p.photoGallery) && p.photoGallery.length > 0) {
          photoUrl = p.photoGallery[0]?.url || p.photoGallery[0];
        }

        return [{
          id: p.id,
          name: p.name || "",
          address: typeof p.address === "string" && p.address.trim() ? p.address : undefined,
          city: p.city,
          categories: Array.isArray(p.categories) ? p.categories : [],
          location: p.location,
          photoUrl: typeof photoUrl === "string" ? photoUrl : undefined,
          rating: typeof p.rating === "number" ? p.rating : undefined,
          phone: p.phone,
        }];
      });

      return {
        success: true,
        query,
        category,
        total: places.length,
        places,
      };
    } catch (err) {
      console.error("Failed to fetch places from place-service:", err);
      return {
        success: false,
        errorCode: "PLACE_SEARCH_UNAVAILABLE",
        places: [],
      };
    }
  },
});
