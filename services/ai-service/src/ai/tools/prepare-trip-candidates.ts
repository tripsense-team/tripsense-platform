import { tool } from "ai";
import { z } from "zod";
import {
  prepareTripCandidates,
  type BrowseCategory,
  type PlaceGroundingStore,
} from "../place-grounding.js";
import type { DeclaredTravelPreferences } from "../../personalization/context-preferences.js";

export interface PrepareTripCandidatesToolContext {
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

export const prepareTripCandidatesInputSchema = z.object({
  destination: z
    .string()
    .min(1)
    .optional()
    .describe("Tên thành phố/điểm đến chính của chuyến đi (tự dùng destinationHint nếu bỏ trống)"),
  categories: z
    .array(categoryEnum)
    .min(1)
    .max(4)
    .optional()
    .describe(
      "Các nhóm địa điểm cần chuẩn bị (mặc định: ATTRACTION, FOOD, CAFE, STAY)",
    ),
  limitPerCategory: z
    .number()
    .min(2)
    .max(8)
    .optional()
    .describe("Số địa điểm tối đa mỗi nhóm (mặc định 5)"),
  vibeQuery: z
    .string()
    .max(120)
    .optional()
    .describe("Phong cách/gu chuyến đi tóm tắt từ cuộc trò chuyện (ví dụ: 'chill biển, ăn địa phương')"),
  preferredCategories: z
    .array(z.string().max(80))
    .max(10)
    .optional()
    .describe("Danh mục ưu tiên bổ sung từ yêu cầu cuộc trò chuyện"),
  dislikedCategories: z
    .array(z.string().max(80))
    .max(10)
    .optional()
    .describe("Danh mục cần tránh theo yêu cầu của khách"),
  lat: z.number().optional().describe("Vĩ độ khu vực trung tâm nếu tìm quanh vị trí"),
  lng: z.number().optional().describe("Kinh độ khu vực trung tâm nếu tìm quanh vị trí"),
});

export function getPrepareTripCandidatesTool(context: PrepareTripCandidatesToolContext = {}) {
  return tool({
    description:
      "Chuẩn bị trước bộ ứng viên địa điểm có gu (cá nhân hóa từ Qdrant + MMR diversity + fallback Place Service, đã nạp sẵn placeId chuẩn và ảnh thật) theo từng danh mục cho chuyến đi trước khi tạo trip proposal.",
    inputSchema: prepareTripCandidatesInputSchema,
    execute: async ({
      destination,
      categories,
      limitPerCategory,
      vibeQuery,
      preferredCategories,
      dislikedCategories,
      lat,
      lng,
    }) => {
      try {
        const resolvedDestination =
          destination?.trim() || readContextString(context.destinationHint)?.trim();
        if (!resolvedDestination) {
          return {
            success: false,
            errorCode: "MISSING_DESTINATION",
            groups: [],
            places: [],
          };
        }

        const result = await prepareTripCandidates({
          destination: resolvedDestination,
          categories: categories as BrowseCategory[] | undefined,
          limitPerCategory,
          vibeQuery,
          preferredCategories,
          dislikedCategories,
          userPreferences: context.userPreferences,
          lat,
          lng,
          tripId: readContextString(context.tripId),
          authorization: context.authorization,
          store: context.store,
        });

        return {
          success: result.success,
          destination: result.destination,
          recommendationCount: result.recommendationCount,
          fallbackTriggered: result.fallbackTriggered,
          total: result.places.length,
          groups: result.groups,
          places: result.places,
        };
      } catch (err) {
        console.error("Failed to prepare trip candidates:", err);
        return {
          success: false,
          errorCode: "CANDIDATE_PREP_UNAVAILABLE",
          groups: [],
          places: [],
        };
      }
    },
  });
}

