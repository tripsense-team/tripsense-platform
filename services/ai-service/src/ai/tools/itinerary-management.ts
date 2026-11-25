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
import { resolveCanonicalActivityPlaces } from "../place-grounding.js";

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
          .enum(["MORNING", "NOON", "AFTERNOON", "EVENING", "FLEXIBLE"])
          .describe(
            "Buổi trong ngày (MORNING: 05:00-10:59, NOON: 11:00-13:29, AFTERNOON: 13:30-17:29, EVENING: từ 17:30, FLEXIBLE: linh hoạt)",
          ),
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
          .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
          .describe("Loại hoạt động (ATTRACTION, FOOD, CAFE, STAY, BEACH, ACTIVITY)"),
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
    .describe("Khung giờ mới (ví dụ '12:30 - 14:00' hoặc '12:30')"),
  clearTimes: z
    .boolean()
    .optional()
    .describe("Đặt true để xóa khung giờ hiện tại (chuyển về chưa xếp giờ)"),
  targetDayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Chuyển mục hoạt động này sang một ngày khác trong chuyến đi (ví dụ: 2 để chuyển sang Ngày 2)"),
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

export const replaceDayItinerarySchema = z.object({
  dayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .describe("Số thứ tự ngày cần thay thế toàn bộ hoạt động (ví dụ: 1 cho Ngày 1, 2 cho Ngày 2)"),
  items: z
    .array(
      z.object({
        period: z
          .enum(["MORNING", "NOON", "AFTERNOON", "EVENING", "FLEXIBLE"])
          .describe("Buổi trong ngày"),
        timeSlot: z
          .string()
          .max(80)
          .optional()
          .describe("Khung giờ gợi ý (ví dụ: '08:00 - 10:30')"),
        title: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("Tên địa điểm hoặc hoạt động cụ thể"),
        description: z
          .string()
          .max(5000)
          .optional()
          .describe("Mô tả hoặc lưu ý cho hoạt động"),
        placeId: z
          .string()
          .optional()
          .describe("ID canonical của địa điểm từ prepareTripCandidates / searchPlaces"),
        category: z
          .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
          .describe("Loại hoạt động"),
      }),
    )
    .min(1)
    .max(50)
    .describe("Danh sách hoạt động mới sẽ THAY THẾ toàn bộ hoạt động cũ trong ngày này"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết)"),
});

export const manageItineraryDaysSchema = z.object({
  action: z
    .enum(["CLEAR_DAY", "SWAP_DAYS"])
    .describe("CLEAR_DAY: xóa toàn bộ hoạt động trong 1 ngày; SWAP_DAYS: hoán đổi toàn bộ hoạt động giữa 2 ngày"),
  dayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Số thứ tự ngày cần xóa trắng (bắt buộc khi action='CLEAR_DAY')"),
  firstDayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Ngày thứ nhất cần hoán đổi (bắt buộc khi action='SWAP_DAYS')"),
  secondDayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Ngày thứ hai cần hoán đổi (bắt buộc khi action='SWAP_DAYS')"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết)"),
});

export const updateTripDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .optional()
    .describe("Tên chuyến đi mới"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Ngày bắt đầu mới (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Ngày kết thúc mới (YYYY-MM-DD)"),
  durationDays: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe("Tổng số ngày mới (tự tính endDate từ startDate hiện tại nếu không truyền endDate)"),
  travelerCount: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Số lượng người đi mới"),
  budgetAmount: z
    .number()
    .nonnegative()
    .optional()
    .describe("Tổng ngân sách mới"),
  budgetCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .describe("Đơn vị tiền tệ 3 ký tự (VND, USD...)"),
  notes: z
    .string()
    .max(5000)
    .optional()
    .describe("Ghi chú chung cho chuyến đi"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết)"),
});

function addDaysToIsoDate(isoDate: string, daysToAdd: number): string | null {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + daysToAdd);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
    .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
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

export const reorderItineraryItemsSchema = z.object({
  dayNumber: z
    .number()
    .int()
    .min(1)
    .max(365)
    .describe("Số thứ tự ngày trong chuyến đi cần sắp xếp lại (ví dụ: 1 cho Ngày 1)"),
  orderedItemIds: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Danh sách đầy đủ itemId theo thứ tự mới mong muốn (nếu không dùng sortByTime)"),
  sortByTime: z
    .boolean()
    .optional()
    .default(false)
    .describe("Đặt true để tự động sắp xếp tất cả mục trong ngày theo startTime tăng dần"),
  preserveTimes: z
    .boolean()
    .optional()
    .default(true)
    .describe("Giữ nguyên khung giờ startTime/endTime hiện có thay vì nối giờ tự động"),
  tripId: z
    .string()
    .optional()
    .describe("ID chuyến đi (mặc định lấy chuyến đi đang liên kết)"),
});

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function sortItineraryItemsByTime<
  T extends { id: string; startTime?: string | null; sortOrder?: number | null },
>(items: T[]): T[] {
  return items
    .map((item, idx) => ({ item, idx, startMin: parseTimeToMinutes(item.startTime) }))
    .sort((a, b) => {
      if (a.startMin !== null && b.startMin !== null && a.startMin !== b.startMin) {
        return a.startMin - b.startMin;
      }
      if (a.startMin !== null && b.startMin === null) return -1;
      if (a.startMin === null && b.startMin !== null) return 1;
      return (a.item.sortOrder ?? a.idx) - (b.item.sortOrder ?? b.idx);
    })
    .map((entry) => entry.item);
}

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

      const resolvedPlaces = await resolveCanonicalActivityPlaces({
        items: input.items.map((it) => ({
          placeId: it.placeId,
          title: it.title.trim(),
          category: it.category,
        })),
        destinationHint: context.runtime?.destinationHint || context.runtime?.brief?.where?.destinationText,
        authorization: context.authorization,
        tripId: targetTripId,
        store: context.runtime?.placeStore,
      });

      const commitItems: TripCommitItem[] = input.items.map((it, idx) => {
        const canonical = resolvedPlaces.get(idx);
        return {
          sourceItemKey: crypto.randomUUID(),
          dayNumber: input.dayNumber,
          title: canonical?.name || it.title.trim(),
          itemType: itemType(it.category),
          placeRef: canonical?.id || null,
          ...parseTimes(it.timeSlot),
          notes: it.description?.trim() || null,
        };
      });

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
          context.runtime.hasTripItems = true;
        }

        return {
          success: true,
          dayNumber: input.dayNumber,
          appliedCount: result.appliedCount,
          skippedCount: result.skippedCount,
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

        const daysList = Array.isArray(data.days) ? data.days : [];
        if (context.runtime) {
          if (typeof data.revision === "number") {
            context.runtime.tripRevision = data.revision;
          }
          context.runtime.tripDaysCount = daysList.length;
          context.runtime.hasTripItems = daysList.some(
            (d: any) => Array.isArray(d?.items) && d.items.length > 0,
          );
        }

        return {
          success: true,
          tripId: targetTripId,
          destinationName: data.destinationName,
          days: daysList.map((d: any) => ({
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
        if (context.runtime && typeof context.runtime.tripRevision === "number") {
          context.runtime.tripRevision += 1;
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
      "Chỉnh sửa tiêu đề, khung giờ, xóa giờ, chuyển sang ngày khác (targetDayNumber) hoặc sửa ghi chú của một hoạt động đã có trong lịch trình.",
    inputSchema: updateItineraryItemSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      const times =
        !input.clearTimes && input.timeSlot
          ? parseTimes(input.timeSlot)
          : { startTime: undefined, endTime: undefined };

      try {
        let targetDayId: string | undefined;
        if (input.targetDayNumber !== undefined) {
          const itinRes = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary`, {
            headers: { Authorization: context.authorization },
          });
          if (!itinRes.ok) {
            return {
              success: false,
              error: `Không thể đọc danh sách ngày để chuyển hoạt động (mã lỗi ${itinRes.status}).`,
            };
          }
          const itinPayload: any = await itinRes.json();
          const targetDay = (itinPayload?.data?.days || []).find(
            (d: any) => Number(d.dayNumber) === Number(input.targetDayNumber),
          );
          if (!targetDay) {
            return {
              success: false,
              error: `Không tìm thấy Ngày ${input.targetDayNumber} trong chuyến đi.`,
            };
          }
          targetDayId = String(targetDay.id);
        }

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
              startTime: input.clearTimes ? undefined : times.startTime || undefined,
              endTime: input.clearTimes ? undefined : times.endTime || undefined,
              clearTimes: input.clearTimes ? true : undefined,
              targetDayId,
              notes: input.notes?.trim() || undefined,
            }),
          }
        );
        if (!res.ok) {
          return { success: false, error: `Không thể cập nhật mục lịch trình (mã lỗi ${res.status}).` };
        }
        const payload: any = await res.json();
        if (context.runtime && typeof context.runtime.tripRevision === "number") {
          context.runtime.tripRevision += 1;
        }
        return {
          success: true,
          targetDayNumber: input.targetDayNumber,
          updatedItem: payload?.data,
          message: input.targetDayNumber
            ? `Đã chuyển và cập nhật hoạt động sang Ngày ${input.targetDayNumber}.`
            : "Đã cập nhật mục hoạt động thành công.",
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
      const resolved = await resolveCanonicalActivityPlaces({
        items: [
          {
            placeId: input.newPlaceId,
            title: input.newTitle.trim(),
            category: input.newCategory,
          },
        ],
        destinationHint: context.runtime?.destinationHint || context.runtime?.brief?.where?.destinationText,
        authorization: context.authorization,
        tripId: targetTripId,
        store: context.runtime?.placeStore,
      });
      const canonical = resolved.get(0);
      const effectiveTitle = canonical?.name || input.newTitle.trim();

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
              title: effectiveTitle,
              placeRef: canonical?.id || null,
              clearPlaceRef: !canonical?.id ? true : undefined,
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
        if (context.runtime && typeof context.runtime.tripRevision === "number") {
          context.runtime.tripRevision += 1;
        }
        return {
          success: true,
          replacedItemId: input.itemId,
          newTitle: effectiveTitle,
          message: `Đã thay thế thành công hoạt động bằng "${effectiveTitle}".`,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || "Không thể kết nối trip-service để thay thế." };
      }
    },
  });

  const replaceDayItinerary = tool({
    description:
      "Thay thế TOÀN BỘ hoạt động của một ngày cụ thể (ví dụ Ngày 1 hoặc Ngày 2) bằng danh sách hoạt động mới (atomic replace, KHÔNG cộng dồn/trùng lặp). BẮT BUỘC gọi khi người dùng muốn 'Làm lại Ngày X', 'Đổi toàn bộ lịch trình Ngày X'.",
    inputSchema: replaceDayItinerarySchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }
      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        const getRes = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary`, {
          headers: { Authorization: context.authorization },
        });
        if (!getRes.ok) {
          return {
            success: false,
            error: `Không thể đọc lịch trình hiện tại (mã lỗi ${getRes.status}).`,
          };
        }
        const getPayload: any = await getRes.json();
        const itineraryData = getPayload?.data;
        const targetDay = (itineraryData?.days || []).find(
          (d: any) => Number(d.dayNumber) === Number(input.dayNumber),
        );
        if (!targetDay) {
          return { success: false, error: `Không tìm thấy Ngày ${input.dayNumber} trong chuyến đi.` };
        }

        const resolvedPlaces = await resolveCanonicalActivityPlaces({
          items: input.items.map((it) => ({
            placeId: it.placeId,
            title: it.title.trim(),
            category: it.category,
          })),
          destinationHint:
            context.runtime?.destinationHint || context.runtime?.brief?.where?.destinationText,
          authorization: context.authorization,
          tripId: targetTripId,
          store: context.runtime?.placeStore,
        });

        const payloadItems = input.items.map((it, idx) => {
          const canonical = resolvedPlaces.get(idx);
          const parsedTimes = parseTimes(it.timeSlot);
          return {
            placeRef: canonical?.id || null,
            type: itemType(it.category),
            title: canonical?.name || it.title.trim(),
            startTime: parsedTimes.startTime,
            endTime: parsedTimes.endTime,
            notes: it.description?.trim() || null,
          };
        });

        const replaceRes = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/days/${targetDay.id}/items`,
          {
            method: "PUT",
            headers: {
              Authorization: context.authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              items: payloadItems,
              version: targetDay.version,
              expectedTripRevision: itineraryData?.revision ?? context.runtime.tripRevision ?? null,
            }),
          },
        );
        if (!replaceRes.ok) {
          return {
            success: false,
            error: `Không thể thay thế lịch trình Ngày ${input.dayNumber} (mã lỗi ${replaceRes.status}).`,
          };
        }
        const replacePayload: any = await replaceRes.json();
        if (context.runtime) {
          if (typeof itineraryData?.revision === "number") {
            context.runtime.tripRevision = itineraryData.revision + 1;
          }
          context.runtime.hasTripItems = true;
        }
        return {
          success: true,
          dayNumber: input.dayNumber,
          replacedCount: payloadItems.length,
          day: replacePayload?.data,
          message: `Đã cập nhật và thay thế sạch toàn bộ ${payloadItems.length} hoạt động cho Ngày ${input.dayNumber}.`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Không thể kết nối trip-service để thay thế lịch trình ngày.",
        };
      }
    },
  });

  const manageItineraryDays = tool({
    description:
      "Quản lý cấp độ ngày: xóa sạch toàn bộ hoạt động trong một ngày (action='CLEAR_DAY') hoặc hoán đổi toàn bộ lịch trình giữa hai ngày (action='SWAP_DAYS').",
    inputSchema: manageItineraryDaysSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }
      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        const getRes = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary`, {
          headers: { Authorization: context.authorization },
        });
        if (!getRes.ok) {
          return {
            success: false,
            error: `Không thể đọc lịch trình hiện tại (mã lỗi ${getRes.status}).`,
          };
        }
        const getPayload: any = await getRes.json();
        const itineraryData = getPayload?.data;
        const currentRevision = itineraryData?.revision ?? context.runtime.tripRevision ?? null;

        if (input.action === "CLEAR_DAY") {
          if (!input.dayNumber) {
            return { success: false, error: "Cần truyền dayNumber khi action là CLEAR_DAY." };
          }
          const targetDay = (itineraryData?.days || []).find(
            (d: any) => Number(d.dayNumber) === Number(input.dayNumber),
          );
          if (!targetDay) {
            return { success: false, error: `Không tìm thấy Ngày ${input.dayNumber} trong chuyến đi.` };
          }
          const query = new URLSearchParams();
          if (typeof targetDay.version === "number") query.set("version", String(targetDay.version));
          if (typeof currentRevision === "number") {
            query.set("expectedTripRevision", String(currentRevision));
          }
          const qs = query.toString() ? `?${query.toString()}` : "";
          const clearRes = await fetch(
            `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/days/${targetDay.id}/items${qs}`,
            {
              method: "DELETE",
              headers: { Authorization: context.authorization },
            },
          );
          if (!clearRes.ok) {
            return {
              success: false,
              error: `Không thể xóa hoạt động của Ngày ${input.dayNumber} (mã lỗi ${clearRes.status}).`,
            };
          }
          const clearPayload: any = await clearRes.json();
          if (context.runtime && typeof currentRevision === "number") {
            context.runtime.tripRevision = currentRevision + 1;
          }
          return {
            success: true,
            action: "CLEAR_DAY",
            dayNumber: input.dayNumber,
            day: clearPayload?.data,
            message: `Đã xóa sạch toàn bộ hoạt động trong Ngày ${input.dayNumber}.`,
          };
        }

        if (!input.firstDayNumber || !input.secondDayNumber) {
          return {
            success: false,
            error: "Cần truyền firstDayNumber và secondDayNumber khi action là SWAP_DAYS.",
          };
        }
        if (input.firstDayNumber === input.secondDayNumber) {
          return { success: false, error: "Hai ngày cần hoán đổi phải khác nhau." };
        }
        const swapRes = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/days/swap`,
          {
            method: "POST",
            headers: {
              Authorization: context.authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              firstDayNumber: input.firstDayNumber,
              secondDayNumber: input.secondDayNumber,
              expectedTripRevision: currentRevision,
            }),
          },
        );
        if (!swapRes.ok) {
          return {
            success: false,
            error: `Không thể hoán đổi Ngày ${input.firstDayNumber} và Ngày ${input.secondDayNumber} (mã lỗi ${swapRes.status}).`,
          };
        }
        const swapPayload: any = await swapRes.json();
        if (context.runtime && typeof currentRevision === "number") {
          context.runtime.tripRevision = currentRevision + 1;
        }
        return {
          success: true,
          action: "SWAP_DAYS",
          firstDayNumber: input.firstDayNumber,
          secondDayNumber: input.secondDayNumber,
          itinerary: swapPayload?.data,
          message: `Đã hoán đổi lịch trình giữa Ngày ${input.firstDayNumber} và Ngày ${input.secondDayNumber}.`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Không thể kết nối trip-service để thao tác với ngày lịch trình.",
        };
      }
    },
  });

  const updateTripDetails = tool({
    description:
      "Cập nhật thông tin tổng quan của chuyến đi hiện tại: số ngày (durationDays), ngày bắt đầu/kết thúc (startDate/endDate), số người (travelerCount), ngân sách (budgetAmount/budgetCurrency), tên hoặc ghi chú chuyến đi.",
    inputSchema: updateTripDetailsSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }
      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        let startDate = input.startDate;
        let endDate = input.endDate;

        if (input.durationDays !== undefined && !endDate) {
          if (!startDate) {
            const tripRes = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}`, {
              headers: { Authorization: context.authorization },
            });
            if (!tripRes.ok) {
              return {
                success: false,
                error: `Không thể đọc thông tin chuyến đi hiện tại (mã lỗi ${tripRes.status}).`,
              };
            }
            const tripPayload: any = await tripRes.json();
            startDate = tripPayload?.data?.startDate;
          }
          if (startDate) {
            const computed = addDaysToIsoDate(startDate, input.durationDays - 1);
            if (!computed) {
              return { success: false, error: "Ngày bắt đầu hiện tại không hợp lệ để tính số ngày." };
            }
            endDate = computed;
          }
        }

        const patchBody: Record<string, unknown> = {};
        if (input.name !== undefined) patchBody.name = input.name.trim();
        if (startDate !== undefined) patchBody.startDate = startDate;
        if (endDate !== undefined) patchBody.endDate = endDate;
        if (input.travelerCount !== undefined) patchBody.travelerCount = input.travelerCount;
        if (input.budgetAmount !== undefined) patchBody.budgetAmount = input.budgetAmount;
        if (input.budgetCurrency !== undefined) patchBody.budgetCurrency = input.budgetCurrency;
        if (input.notes !== undefined) patchBody.notes = input.notes.trim();

        const res = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}`, {
          method: "PATCH",
          headers: {
            Authorization: context.authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        });
        if (!res.ok) {
          const errPayload: any = await res.json().catch(() => null);
          const errCode = errPayload?.error?.code || errPayload?.code;
          if (errCode === "DATE_CHANGE_BLOCKED") {
            return {
              success: false,
              errorCode: "DATE_CHANGE_BLOCKED",
              error:
                "Không thể rút ngắn số ngày vì các ngày bị cắt vẫn còn hoạt động. Hãy dùng manageItineraryDays(CLEAR_DAY) xóa hoặc chuyển hoạt động sang ngày trước đó rồi đổi lại số ngày.",
            };
          }
          return {
            success: false,
            error: `Không thể cập nhật thông tin chuyến đi (mã lỗi ${res.status}).`,
          };
        }

        const payload: any = await res.json();
        const updated = payload?.data;
        if (context.runtime && updated) {
          if (updated.startDate && updated.endDate) {
            const s = Date.parse(`${updated.startDate}T00:00:00Z`);
            const e = Date.parse(`${updated.endDate}T00:00:00Z`);
            const computedDays =
              !Number.isNaN(s) && !Number.isNaN(e) ? Math.floor((e - s) / 86_400_000) + 1 : undefined;
            if (computedDays && computedDays > 0) {
              context.runtime.tripDaysCount = computedDays;
            }
            context.runtime.brief = {
              ...context.runtime.brief,
              when: {
                ...context.runtime.brief?.when,
                startDate: updated.startDate,
                endDate: updated.endDate,
                durationDays: computedDays ?? context.runtime.brief?.when?.durationDays,
              },
            };
          }
        }
        return {
          success: true,
          trip: updated,
          message: "Đã cập nhật thông tin chuyến đi thành công.",
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Không thể kết nối trip-service để cập nhật chuyến đi.",
        };
      }
    },
  });

  const reorderItineraryItems = tool({
    description:
      "Sắp xếp lại thứ tự các hoạt động trong một ngày (theo khung giờ tăng dần với sortByTime=true hoặc theo danh sách orderedItemIds cụ thể). Dùng khi người dùng yêu cầu 'Sắp xếp lại Ngày 1 theo thời gian', 'Đưa địa điểm A lên trước B'.",
    inputSchema: reorderItineraryItemsSchema,
    execute: async (input) => {
      const targetTripId = input.tripId || context.runtime.tripId;
      if (!targetTripId) {
        return { success: false, error: "Chưa có chuyến đi liên kết." };
      }

      if (!context.authorization) {
        return { success: false, error: "Vui lòng đăng nhập để thao tác với chuyến đi." };
      }

      try {
        const getRes = await fetch(`${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary`, {
          headers: { Authorization: context.authorization },
        });
        if (!getRes.ok) {
          return { success: false, error: `Không thể đọc lịch trình hiện tại (mã lỗi ${getRes.status}).` };
        }
        const getPayload: any = await getRes.json();
        const itineraryData = getPayload?.data;
        const targetDay = (itineraryData?.days || []).find(
          (d: any) => Number(d.dayNumber) === Number(input.dayNumber),
        );
        if (!targetDay) {
          return { success: false, error: `Không tìm thấy Ngày ${input.dayNumber} trong chuyến đi.` };
        }
        const currentItems: any[] = Array.isArray(targetDay.items) ? targetDay.items : [];
        if (currentItems.length < 2) {
          return {
            success: true,
            dayNumber: input.dayNumber,
            message: `Ngày ${input.dayNumber} hiện có dưới 2 hoạt động nên không cần sắp xếp lại.`,
          };
        }

        let nextIds: string[];
        if (input.sortByTime) {
          nextIds = sortItineraryItemsByTime(currentItems).map((it) => String(it.id));
        } else if (Array.isArray(input.orderedItemIds) && input.orderedItemIds.length > 0) {
          const existingSet = new Set(currentItems.map((it) => String(it.id)));
          const requestedSet = new Set(input.orderedItemIds);
          if (
            requestedSet.size !== input.orderedItemIds.length ||
            requestedSet.size !== existingSet.size ||
            [...existingSet].some((id) => !requestedSet.has(id))
          ) {
            return {
              success: false,
              error: "Danh sách orderedItemIds không khớp đủ các hoạt động hiện có trong ngày. Hãy gọi getTripItinerary trước.",
            };
          }
          nextIds = input.orderedItemIds;
        } else {
          return {
            success: false,
            error: "Cần truyền sortByTime=true hoặc danh sách orderedItemIds đầy đủ.",
          };
        }

        const reorderRes = await fetch(
          `${config.tripServiceUrl}/api/trips/${targetTripId}/itinerary/days/${targetDay.id}/items/reorder`,
          {
            method: "PUT",
            headers: {
              Authorization: context.authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderedItemIds: nextIds,
              version: targetDay.version,
              expectedTripRevision: itineraryData?.revision ?? context.runtime.tripRevision ?? null,
              preserveTimes: input.preserveTimes ?? true,
            }),
          },
        );
        if (!reorderRes.ok) {
          return {
            success: false,
            error: `Không thể sắp xếp lại lịch trình (mã lỗi ${reorderRes.status}).`,
          };
        }

        const reorderPayload: any = await reorderRes.json();
        if (context.runtime && typeof itineraryData?.revision === "number") {
          context.runtime.tripRevision = itineraryData.revision + 1;
        }
        return {
          success: true,
          dayNumber: input.dayNumber,
          orderedItemIds: nextIds,
          day: reorderPayload?.data,
          message: input.sortByTime
            ? `Đã sắp xếp lại Ngày ${input.dayNumber} theo khung giờ tăng dần.`
            : `Đã cập nhật thứ tự hoạt động cho Ngày ${input.dayNumber}.`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Không thể kết nối trip-service để sắp xếp lịch trình.",
        };
      }
    },
  });

  return {
    addItineraryItems,
    replaceDayItinerary,
    manageItineraryDays,
    updateTripDetails,
    getTripItinerary,
    removeItineraryItem,
    updateItineraryItem,
    replaceItineraryItem,
    reorderItineraryItems,
  };
}
