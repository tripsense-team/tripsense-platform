import { tool } from "ai";
import { z } from "zod";
import {
  groundRecommendations,
  type PlaceGroundingStore,
  type PlaceSearchResult,
} from "../place-grounding.js";

export interface RecommendPlacesToolContext {
  destinationHint?: string | (() => string | undefined);
  tripId?: string | (() => string | undefined);
  authorization?: string;
  store?: PlaceGroundingStore;
}

function readContextString(value?: string | (() => string | undefined)): string | undefined {
  return typeof value === "function" ? value() : value;
}

export const recommendPlacesSchema = z.object({
  title: z
    .string()
    .trim()
    .default("Địa điểm gợi ý cho chuyến đi")
    .describe(
      "Tiêu đề ngắn gọn cho nhóm địa điểm gợi ý (ví dụ: 'Điểm đến nổi bật tại Đà Nẵng', 'Quán ngon đặc sản nên thử')"
    ),
  destination: z
    .string()
    .trim()
    .optional()
    .describe("Điểm đến / Thành phố chính (ví dụ: 'Đà Nẵng', 'Phú Quốc', 'Hà Nội')"),
  places: z
    .array(
      z.object({
        placeId: z
          .string()
          .trim()
          .optional()
          .describe(
            "ID địa điểm thật từ kết quả searchPlaces nếu có (ưu tiên truyền để giữ đúng ảnh thật, toạ độ và đánh giá)"
          ),
        name: z
          .string()
          .trim()
          .min(1)
          .describe(
            "Tên địa điểm chuẩn tiếng Việt (ví dụ: 'Bãi biển Mỹ Khê', 'Bán đảo Sơn Trà', 'Cầu Rồng', 'Chợ Đêm Sơn Trà')"
          ),
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
        photoUrl: z.string().url().optional().describe("URL ảnh nếu có"),
        lat: z.number().optional().describe("Vĩ độ toạ độ nếu biết"),
        lng: z.number().optional().describe("Kinh độ toạ độ nếu biết"),
      })
    )
    .min(1)
    .max(12)
    .describe("Danh sách các địa điểm tinh tuyển do chính AI lựa chọn cho chuyến đi"),
});

function hasRealCatalogPhoto(photoUrl?: string): boolean {
  return Boolean(photoUrl && !photoUrl.includes("images.unsplash.com"));
}

export function getRecommendPlacesTool(context: RecommendPlacesToolContext = {}) {
  return tool({
    description:
      "Gợi ý danh sách các địa điểm du lịch, ẩm thực, check-in tinh tuyển hiển thị thành dải thẻ trực quan cho chuyến đi. Mọi địa điểm sẽ được đối chiếu và làm giàu ảnh thật, toạ độ và đánh giá từ hệ thống TripSense.",
    inputSchema: recommendPlacesSchema,
    execute: async ({ title, destination, places }) => {
      const resolvedDestination = destination || readContextString(context.destinationHint);
      const tripId = readContextString(context.tripId);
      const grounded = await groundRecommendations({
        places,
        destination: resolvedDestination,
        authorization: context.authorization,
        tripId,
        store: context.store,
      });

      // Stable prioritization: catalog-grounded + real-photo items appear first in the carousel.
      const formattedPlaces: PlaceSearchResult[] = [...grounded].sort((a, b) => {
        const aScore = (a.grounded ? 2 : 0) + (hasRealCatalogPhoto(a.photoUrl) ? 1 : 0);
        const bScore = (b.grounded ? 2 : 0) + (hasRealCatalogPhoto(b.photoUrl) ? 1 : 0);
        return bScore - aScore;
      });

      return {
        success: true,
        title:
          title ||
          (resolvedDestination
            ? `Địa điểm gợi ý tại ${resolvedDestination}`
            : "Địa điểm gợi ý cho chuyến đi"),
        destination: resolvedDestination,
        total: formattedPlaces.length,
        groundedCount: formattedPlaces.filter((p) => p.grounded).length,
        places: formattedPlaces,
      };
    },
  });
}

export const recommendPlaces = getRecommendPlacesTool();
