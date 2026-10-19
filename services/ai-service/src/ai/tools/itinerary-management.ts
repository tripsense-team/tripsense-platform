import { tool } from "ai";
import { z } from "zod";
import crypto from "node:crypto";
import { config } from "../../config.js";
import {
  commitTripMutation,
  deterministicCommitKey,
  sha256,
  type TripCommitItem,
} from "../trip-commit.js";
import type { PlanningRuntimeState } from "./update-trip-planning-brief.js";
import { itemType, parseTimes } from "./create-trip-proposal.js";

export interface ItineraryToolContext {
  chatId: string;
  userId: string;
  authorization?: string;
  runtime: PlanningRuntimeState;
}

export const addItineraryItemsSchema = z.object({
  dayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .describe("Số thứ tự ngày trong chuyến đi cần thêm hoạt động vào (ví dụ: 1 cho Ngày 1, 2 cho Ngày 2)"),
  items: z
    .array(
      z.object({
        period: z
          .enum(["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"])
          .describe("Buổi trong ngày để trình bày nhất quán"),
        timeSlot: z
          .string()
          .max(80)
          .optional()
          .describe("Khung giờ gợi ý (ví dụ: '08:00 - 10:30', '12:00 - 13:30', '19:00 - 21:00')"),
        title: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("Tên hoạt động hoặc địa điểm (ví dụ: 'Check-in Bãi biển Mỹ Khê', 'Ăn trưa Bánh tráng cuốn thịt heo')"),
        description: z
          .string()
          .max(5000)
          .optional()
          .describe("Mô tả chi tiết trải nghiệm, lưu ý hoặc món ăn nên thử"),
        placeId: z
          .string()
          .optional()
          .describe("ID canonical của địa điểm từ kết quả searchPlaces"),
        category: z
          .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "ACTIVITY"])
          .describe("Loại hoạt động"),
        estimatedCost: z
          .string()
          .optional()
          .describe("Chi phí dự kiến cho hoạt động"),
      })
    )
    .min(1)
    .describe("Danh sách các hoạt động cần thêm vào ngày này"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết với cuộc trò chuyện hiện tại)"),
});

export const getTripItinerarySchema = z.object({
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết)"),
});

export const removeItineraryItemSchema = z.object({
  itemId: z
    .string()
    .describe("UUID của mục lịch trình cần xóa khỏi chuyến đi"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi"),
});

export const updateItineraryItemSchema = z.object({
  itemId: z
    .string()
    .describe("UUID của mục lịch trình cần chỉnh sửa"),
  title: z
    .string()
    .max(200)
    .optional()
    .describe("Tiêu đề mới của hoạt động"),
  timeSlot: z
    .string()
    .max(80)
    .optional()
    .describe("Khung giờ mới (ví dụ '12:30 - 14:00')"),
  notes: z
    .string()
    .max(5000)
    .optional()
    .describe("Ghi chú mới cho hoạt động"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi"),
});

export const replaceItineraryItemSchema = z.object({
  itemId: z
    .string()
    .describe("UUID của mục lịch trình cũ cần thay thế"),
  newTitle: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Tên địa điểm hoặc hoạt động mới"),
  newPlaceId: z
    .string()
    .optional()
    .describe("ID địa điểm mới từ kết quả searchPlaces nếu có"),
  newCategory: z
    .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "ACTIVITY"])
    .optional()
    .describe("Loại hoạt động mới"),
  timeSlot: z
    .string()
    .max(80)
    .optional()
    .describe("Khung giờ (giữ nguyên khung giờ cũ hoặc đổi mới)"),
  notes: z
    .string()
    .max(5000)
    .optional()
    .describe("Ghi chú mới cho hoạt động thay thế"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi"),
});

export function getItineraryManagementTools(context: ItineraryToolContext) {
  const addItineraryItems = tool({
    description:
      "Thêm một hoặc nhiều địa điểm/hoạt động vào một ngày cụ thể (ví dụ Ngày 1, Ngày 2) của chuyến đi đang liên kết. BẮT BUỘC gọi khi người dùng yêu cầu 'Gợi ý lịch trình cho Ngày 1', 'Lên kế hoạch Ngày X', 'Thêm quán cafe/điểm đến vào Ngày X'.",
    inputSchema: addItineraryItemsSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return {
          success: false,
          error: "Chưa có chuyến đi nào được liên kết để thêm hoạt động.",
        };
      }

      if (!context.authorization) {
        return {
          success: false,
          error: "Vui lòng đăng nhập để thao tác với chuyến đi.",
        };
      }

      const commitItems: TripCommitItem[] = input.items.map((it) => ({
        sourceItemKey: crypto.randomUUID(),
        dayNumber: input.dayNumber,
        title: it.title.trim(),
        itemType: itemType(it.category),
        placeRef: it.placeId || null,
        ...parseTimes(it.timeSlot),
        notes: it.description?.trim() || null,
      }));

      try {
        const proposalId = crypto.randomUUID();
        const result = await commitTripMutation({
          authorization: context.authorization,
          userId: context.userId,
          idempotencyKey: deterministicCommitKey(
            context.chatId,
            proposalId,
            `ADD_ITEMS_D${input.dayNumber}`
          ),
          request: {
            action: "ADD_TO_TRIP",
            targetTripId,
            proposalId,
            proposalHash: sha256(JSON.stringify(commitItems)),
            expectedTripRevision: context.runtime.tripRevision ?? null,
            tripDraft: null,
            items: commitItems,
          },
        });

        if (context.runtime) {
          context.runtime.tripRevision = result.tripRevision;
        }

        return {
          success: true,
          dayNumber: input.dayNumber,
          appliedCount: result.appliedCount,
          message: `Đã thêm thành công ${result.appliedCount} hoạt động vào Ngày ${input.dayNumber} của chuyến đi.`,
          items: result.items,
        };
      } catch (err: any) {
        console.error("Failed to add itinerary items:", err);
        return {
          success: false,
          error: err?.message || "Không thể thêm hoạt động vào chuyến đi lúc này.",
        };
      }
    },
  });

  const getTripItinerary = tool({
    description:
      "Đọc chi tiết toàn bộ các ngày và các mục hoạt động hiện có trong lịch trình chuyến đi (bao gồm itemId, tiêu đề, giờ giấc). Dùng để kiểm tra trước khi sửa, xóa hoặc thay thế địa điểm.",
    inputSchema: getTripItinerarySchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        const res = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary`, {
          headers: {
            Authorization: context.authorization,
          },
        });
        if (!res.ok) {
          return { success: false, error: `Lỗi khi lấy lịch trình: ${res.statusText}` };
        }
        const payload: any = await res.json();
        const data = payload?.data;
        if (!data) return { success: false, error: "Không tìm thấy dữ liệu lịch trình." };

        return {
          success: true,
          tripId: targetTripId,
          destinationName: data.destinationName,
          days: (data.days || []).map((d: any) => ({
            dayId: d.id,
            dayNumber: d.dayNumber,
            date: d.date,
            items: (d.items || []).map((it: any) => ({
              itemId: it.id,
              title: it.title,
              type: it.type,
              placeRef: it.placeRef,
              placeName: it.placeNameSnapshot,
              startTime: it.startTime,
              endTime: it.endTime,
              notes: it.notes,
            })),
          })),
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Không thể kết nối trip-service." };
      }
    },
  });

  const removeItineraryItem = tool({
    description:
      "Xóa một hoạt động/địa điểm khỏi lịch trình chuyến đi bằng itemId. Dùng khi người dùng yêu cầu 'Xóa quán X', 'Bỏ điểm Y khỏi Ngày Z'.",
    inputSchema: removeItineraryItemSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        const res = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/items/${input.itemId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: context.authorization,
            },
          }
        );
        if (!res.ok && res.status !== 204) {
          return { success: false, error: `Không thể xóa mục lịch trình (mã lỗi ${res.status}).` };
        }
        return {
          success: true,
          removedItemId: input.itemId,
          message: "Đã xóa mục hoạt động thành công khỏi lịch trình.",
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Không thể kết nối trip-service để xóa." };
      }
    },
  });

  const updateItineraryItem = tool({
    description:
      "Chỉnh sửa tiêu đề, khung giờ hoặc ghi chú của một hoạt động đã có trong lịch trình. Dùng khi người dùng nói 'Đổi giờ ăn trưa sang 12:30', 'Sửa ghi chú Ngày X'.",
    inputSchema: updateItineraryItemSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      const times = input.timeSlot ? parseTimes(input.timeSlot) : { startTime: undefined, endTime: undefined };

      try {
        const res = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/items/${input.itemId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: context.authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: input.title?.trim() || undefined,
              startTime: times.startTime || undefined,
              endTime: times.endTime || undefined,
              notes: input.notes?.trim() || undefined,
            }),
          }
        );
        if (!res.ok) {
          return { success: false, error: `Không thể cập nhật mục lịch trình (mã lỗi ${res.status}).` };
        }
        const payload: any = await res.json();
        return {
          success: true,
          updatedItem: payload?.data,
          message: "Đã cập nhật mục hoạt động thành công.",
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Không thể kết nối trip-service để cập nhật." };
      }
    },
  });

  const replaceItineraryItem = tool({
    description:
      "Thay thế một địa điểm hoặc hoạt động hiện có bằng địa điểm mới tại cùng khung giờ. Dùng khi người dùng yêu cầu 'Đổi khách sạn sang X', 'Thay quán ăn này bằng quán khác'.",
    inputSchema: replaceItineraryItemSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      const times = input.timeSlot ? parseTimes(input.timeSlot) : { startTime: undefined, endTime: undefined };

      try {
        const res = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/items/${input.itemId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: context.authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: input.newTitle.trim(),
              placeRef: input.newPlaceId || null,
              type: input.newCategory ? itemType(input.newCategory) : undefined,
              startTime: times.startTime || undefined,
              endTime: times.endTime || undefined,
              notes: input.notes?.trim() || undefined,
            }),
          }
        );
        if (!res.ok) {
          return { success: false, error: `Không thể thay thế mục lịch trình (mã lỗi ${res.status}).` };
        }
        return {
          success: true,
          replacedItemId: input.itemId,
          newTitle: input.newTitle,
          message: `Đã thay thế thành công hoạt động bằng "${input.newTitle}".`,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Không thể kết nối trip-service để thay thế." };
      }
    },
  });

  return {
    addItineraryItems,
    getTripItinerary,
    removeItineraryItem,
    updateItineraryItem,
    replaceItineraryItem,
  };
}
