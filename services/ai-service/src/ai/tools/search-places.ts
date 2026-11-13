import { tool } from "ai";
import { z } from "zod";
import {
  executeHybridPlaceSearch,
  mapUserPreferencesToCategories,
  mergePlaceRecords,
  type BrowseCategory,
  type PlaceGroundingStore,
  type PlaceSearchResult,
} from "../place-grounding.js";
import type { DeclaredTravelPreferences } from "../../personalization/context-preferences.js";

export type { PlaceSearchResult };

export interface SearchPlacesToolContext {
  destinationHint?: string | (() => string | undefined);
  tripId?: string | (() => string | undefined);
  authorization?: string;
  userPreferences?: DeclaredTravelPreferences;
  store?: PlaceGroundingStore;
}

function readContextString(value?: string | (() => string | undefined)): string | undefined {
  return typeof value === "function" ? value() : value;
}

const categoryEnum = z.enum(["FOOD", "CAFE", "STAY", "ATTRACTION", "BEACH", "ACTIVITY"]);

export const searchPlacesInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Từ khoá tìm kiếm đơn lẻ, ví dụ: 'hải sản Mỹ Khê', 'cafe view biển Đà Nẵng', 'khách sạn gần phố cổ'"
    ),
  queries: z
    .array(
      z.object({
        query: z.string().min(1).describe("Từ khoá tìm kiếm cho nhóm địa điểm này"),
        category: categoryEnum.optional().describe("Phân loại danh mục cho nhóm tìm kiếm này"),
        limit: z.number().min(1).max(10).optional().describe("Số lượng tối đa (1 đến 10)"),
      })
    )
    .min(1)
    .max(4)
    .optional()
    .describe(
      "Tìm kiếm song song nhiều nhóm địa điểm trong 1 lần gọi (tối đa 4 truy vấn cùng lúc, ví dụ ẩm thực + cafe + khách sạn + điểm tham quan)"
    ),
  category: categoryEnum
    .optional()
    .describe(
      "Phân loại địa điểm: FOOD (ẩm thực), CAFE (cà phê), STAY (khách sạn/homestay), ATTRACTION (điểm tham quan), BEACH (biển), ACTIVITY (hoạt động)"
    ),
  limit: z.number().default(5).describe("Số lượng địa điểm tối đa cần lấy (1 đến 10)"),
  lat: z.number().optional().describe("Vĩ độ toạ độ nếu tìm quanh vị trí cụ thể"),
  lng: z.number().optional().describe("Kinh độ toạ độ nếu tìm quanh vị trí cụ thể"),
});

export function getSearchPlacesTool(context: SearchPlacesToolContext = {}) {
  return tool({
    description:
      "Tìm kiếm địa điểm du lịch, ẩm thực, quán cafe, khách sạn, điểm check-in có thật trong hệ thống TripSense (hỗ trợ cả tìm đơn lẻ hoặc nhiều nhóm song song qua `queries`).",
    inputSchema: searchPlacesInputSchema,
    execute: async ({ query, queries, category, limit, lat, lng }) => {
      try {
        const destinationHint = readContextString(context.destinationHint);
        const tripId = readContextString(context.tripId);
        const preferredCategories = mapUserPreferencesToCategories(context.userPreferences);

        if (queries && queries.length > 0) {
          const batchResults = await Promise.all(
            queries.map((item) =>
              executeHybridPlaceSearch({
                query: item.query,
                category: (item.category ?? category) as BrowseCategory | undefined,
                limit: item.limit ?? limit,
                lat,
                lng,
                preferredCategories,
                destinationHint,
                tripId,
                authorization: context.authorization,
                store: context.store,
              })
            )
          );

          const deduped = new Map<string, PlaceSearchResult>();
          const groups = queries.map((item, idx) => {
            const res = batchResults[idx];
            for (const p of res.places) {
              const existing = deduped.get(p.id);
              deduped.set(p.id, existing ? mergePlaceRecords(existing, p) : p);
            }
            return {
              query: res.effectiveQuery || item.query,
              category: item.category ?? category,
              total: res.places.length,
              places: res.places,
            };
          });

          const combinedPlaces = Array.from(deduped.values());
          const anySuccess = batchResults.some((r) => r.success);

          return {
            success: anySuccess,
            ...(!anySuccess ? { errorCode: "PLACE_SEARCH_UNAVAILABLE" } : {}),
            mode: "batch" as const,
            groups,
            total: combinedPlaces.length,
            places: combinedPlaces,
          };
        }

        if (!query || !query.trim()) {
          return {
            success: false,
            errorCode: "MISSING_QUERY",
            places: [],
          };
        }

        const single = await executeHybridPlaceSearch({
          query,
          category: category as BrowseCategory | undefined,
          limit,
          lat,
          lng,
          preferredCategories,
          destinationHint,
          tripId,
          authorization: context.authorization,
          store: context.store,
        });

        if (!single.success) {
          return {
            success: false,
            errorCode: single.errorCode || "PLACE_SEARCH_UNAVAILABLE",
            places: [],
          };
        }

        return {
          success: true,
          query: single.effectiveQuery,
          category,
          total: single.places.length,
          places: single.places,
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
}

export const searchPlaces = getSearchPlacesTool();
