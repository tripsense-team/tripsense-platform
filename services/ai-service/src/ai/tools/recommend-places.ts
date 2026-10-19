import { tool } from "ai";
import { z } from "zod";
import crypto from "node:crypto";
import type { PlaceSearchResult } from "./search-places.js";

const DEFAULT_CATEGORY_PHOTOS: Record<string, string> = {
  BEACH: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  ATTRACTION: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80",
  FOOD: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
  CAFE: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80",
  STAY: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
  ACTIVITY: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
};

export const recommendPlacesSchema = z.object({
  title: z
    .string()
    .trim()
    .default("Địa điểm gợi ý cho chuyến đi")
    .describe("Tiêu đề ngắn gọn cho nhóm địa điểm gợi ý (ví dụ: 'Điểm đến nổi bật tại Đà Nẵng', 'Quán ngon đặc sản nên thử')"),
  destination: z
    .string()
    .trim()
    .optional()
    .describe("Điểm đến / Thành phố chính (ví dụ: 'Đà Nẵng', 'Phú Quốc', 'Hà Nội')"),
  places: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1)
          .describe("Tên địa điểm chuẩn tiếng Việt (ví dụ: 'Bãi biển Mỹ Khê', 'Bán đảo Sơn Trà', 'Cầu Rồng', 'Chợ Đêm Sơn Trà')"),
        category: z
          .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
          .describe("Phân loại danh mục địa điểm"),
        reason: z
          .string()
          .trim()
          .optional()
          .describe("Lý do hoặc điểm nhấn ngắn gọn tại sao AI gợi ý địa điểm này"),
        address: z
          .string()
          .trim()
          .optional()
          .describe("Địa chỉ cụ thể hoặc khu vực nếu có"),
        rating: z
          .number()
          .min(1)
          .max(5)
          .optional()
          .describe("Đánh giá sao tham khảo (ví dụ: 4.8)"),
        photoUrl: z
          .string()
          .url()
          .optional()
          .describe("URL ảnh nếu có"),
        lat: z.number().optional().describe("Vĩ độ toạ độ nếu biết"),
        lng: z.number().optional().describe("Kinh độ toạ độ nếu biết"),
      })
    )
    .min(1)
    .max(12)
    .describe("Danh sách các địa điểm tinh tuyển do chính AI lựa chọn cho chuyến đi"),
});

export const recommendPlaces = tool({
  description:
    "Gợi ý danh sách các địa điểm du lịch, ẩm thực, check-in tinh tuyển do chính AI tuyển chọn cho chuyến đi. Kích hoạt khi người dùng hỏi tư vấn điểm đến, gợi ý chỗ ăn chơi hoặc khi lập kế hoạch chuyến đi.",
  inputSchema: recommendPlacesSchema,
  execute: async ({ title, destination, places }) => {
    const formattedPlaces: PlaceSearchResult[] = places.map((p, idx) => {
      const categoryKey = p.category.toUpperCase();
      const fallbackPhoto =
        DEFAULT_CATEGORY_PHOTOS[categoryKey] || DEFAULT_CATEGORY_PHOTOS.ATTRACTION;
      return {
        id: `ai-rec-${idx + 1}-${crypto.randomUUID().slice(0, 8)}`,
        name: p.name,
        categories: [p.category.toLowerCase()],
        address: p.address,
        city: destination,
        rating: p.rating || 4.7,
        photoUrl: p.photoUrl || fallbackPhoto,
        location: p.lat && p.lng ? { lat: p.lat, lng: p.lng } : undefined,
        reason: p.reason,
      };
    });

    return {
      success: true,
      title:
        title ||
        (destination
          ? `Địa điểm gợi ý tại ${destination}`
          : "Địa điểm gợi ý cho chuyến đi"),
      destination,
      total: formattedPlaces.length,
      places: formattedPlaces,
    };
  },
});
