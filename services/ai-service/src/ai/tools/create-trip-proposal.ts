import { tool } from "ai";
import { z } from "zod";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { messages, proposals } from "../../db/schema.js";
import { config } from "../../config.js";
import {
  commitTripMutation,
  deterministicCommitKey,
  type TripCommitItem,
} from "../trip-commit.js";
import {
  resolveCanonicalActivityPlaces,
  selectComplementarySuggestedPlaces,
} from "../place-grounding.js";
import type { PlanningRuntimeState } from "./update-trip-planning-brief.js";

export type ActivityPeriod = "MORNING" | "NOON" | "AFTERNOON" | "EVENING" | "FLEXIBLE";

const activitySchema = z.object({
  period: z
    .enum(["MORNING", "NOON", "AFTERNOON", "EVENING", "FLEXIBLE"])
    .describe(
      "Buổi trong ngày (MORNING: 05:00-10:59, NOON: 11:00-13:29, AFTERNOON: 13:30-17:29, EVENING: từ 17:30, FLEXIBLE: linh hoạt)",
    ),
  timeSlot: z
    .string().max(80)
    .describe("Khung giờ gợi ý (ví dụ: '08:00 - 10:30', '11:30 - 13:00', '19:00 - 21:00')"),
  title: z
    .string().trim().min(1).max(200)
    .describe(
      "Tên địa điểm/quán cụ thể từ prepareTripCandidates hoặc searchPlaces (ví dụ: 'Cổng Chùa Linh Ứng', 'Hải sản Bé Mặn', 'Chợ Hàn'), hoặc hoạt động logistics ngắn (ví dụ: 'Check-out khách sạn & gửi hành lý')",
    ),
  description: z
    .string().max(5000)
    .describe("Mô tả trải nghiệm chi tiết, lưu ý di chuyển, món ăn nên thử"),
  placeId: z
    .string()
    .optional()
    .describe("ID địa điểm từ place-service nếu tìm được"),
  address: z
    .string()
    .optional()
    .describe("Địa chỉ cụ thể của địa điểm"),
  category: z
    .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
    .describe("Loại hoạt động (ATTRACTION, FOOD, CAFE, STAY, BEACH, ACTIVITY)"),
  estimatedCost: z
    .string()
    .optional()
    .describe("Chi phí dự kiến cho hoạt động (ví dụ: '150.000 VNĐ / người')"),
});

const dayPlanSchema = z.object({
  dayNumber: z.number().int().min(1).max(365).describe("Số thứ tự ngày (1, 2, 3...)"),
  theme: z
    .string().trim().min(1).max(200)
    .describe("Chủ đề nổi bật trong ngày (ví dụ: 'Biển Mỹ Khê & Bán đảo Sơn Trà', 'Phố cổ Hội An & Thả đèn hoa đăng')"),
  activities: z
    .array(activitySchema)
    .min(1)
    .describe("Danh sách các hoạt động theo mốc thời gian trong ngày"),
});

export const createTripProposalSchema = z.object({
  title: z
    .string().trim().min(1).max(160)
    .describe("Tiêu đề chuyến đi hấp dẫn (ví dụ: 'Khám phá Đà Nẵng - Hội An 3 Ngày 2 Đêm')"),
  destination: z
    .string().trim().min(1).max(255)
    .describe("Điểm đến chính (ví dụ: 'Đà Nẵng', 'Hà Nội', 'Phú Quốc')"),
  durationDays: z
    .number().int().min(1).max(365)
    .describe("Tổng số ngày của chuyến đi (ví dụ: 3)"),
  estimatedBudget: z
    .string()
    .optional()
    .describe("Tổng ngân sách dự trù toàn chuyến đi (ví dụ: '3.500.000 - 5.000.000 VNĐ / người')"),
  summary: z
    .string().max(5000)
    .describe("Tóm tắt ngắn gọn phong cách và điểm nổi bật của lịch trình"),
  commitMode: z
    .enum(["ADD_TO_TRIP", "REPLACE_DAYS", "REPLACE_TRIP_ITEMS"])
    .optional()
    .describe(
      "Chế độ đồng bộ vào chuyến đi: dùng 'REPLACE_TRIP_ITEMS' khi cập nhật/làm lại toàn bộ lịch trình đã có, 'REPLACE_DAYS' khi thay thế các ngày cụ thể, hoặc 'ADD_TO_TRIP' chỉ khi thêm vào chuyến đi còn trống.",
    ),
  days: z
    .array(dayPlanSchema)
    .min(1)
    .describe("Kế hoạch chi tiết theo từng ngày"),
});

export function resolveProposalCommitAction(params: {
  explicitMode?: "ADD_TO_TRIP" | "REPLACE_DAYS" | "REPLACE_TRIP_ITEMS";
  dayNumbers: number[];
  hasTripItems?: boolean;
  tripDaysCount?: number;
}): {
  action: "ADD_TO_TRIP" | "REPLACE_DAYS" | "REPLACE_TRIP_ITEMS";
  replaceDayNumbers?: number[];
} {
  if (params.explicitMode === "REPLACE_TRIP_ITEMS") {
    return { action: "REPLACE_TRIP_ITEMS" };
  }
  if (params.explicitMode === "REPLACE_DAYS") {
    return { action: "REPLACE_DAYS", replaceDayNumbers: params.dayNumbers };
  }
  if (params.hasTripItems) {
    const existingDaysCount = params.tripDaysCount ?? params.dayNumbers.length;
    if (params.dayNumbers.length >= existingDaysCount) {
      return { action: "REPLACE_TRIP_ITEMS" };
    }
    return { action: "REPLACE_DAYS", replaceDayNumbers: params.dayNumbers };
  }
  return { action: "ADD_TO_TRIP" };
}

export const itemType = (category?: string): TripCommitItem["itemType"] => {
  if (category === "FOOD" || category === "CAFE") return "MEAL";
  if (category === "STAY") return "HOTEL";
  if (category === "ATTRACTION" || category === "BEACH") return "PLACE";
  return "ACTIVITY";
};

export const normalizeActivityPeriod = (
  period: ActivityPeriod,
  timeSlot?: string,
): ActivityPeriod => {
  if (period === "FLEXIBLE") return "FLEXIBLE";
  const rangeMatch = timeSlot?.match(/(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/);
  if (!rangeMatch) return period;

  const startHour = Number(rangeMatch[1]);
  const startMinute = Number(rangeMatch[2]);
  if (startHour > 23 || startMinute > 59) return period;

  const startMinutes = startHour * 60 + startMinute;
  const endHour = rangeMatch[3] ? Number(rangeMatch[3]) : null;
  const endMinute = rangeMatch[4] ? Number(rangeMatch[4]) : null;
  const endMinutes =
    endHour !== null && endMinute !== null && endHour <= 23 && endMinute <= 59
      ? endHour * 60 + endMinute
      : null;

  if (startMinutes >= 300 && startMinutes < 660 && period === "NOON") {
    return "MORNING";
  }
  const isNoonSlot =
    (startMinutes >= 690 && startMinutes < 810) ||
    (startMinutes >= 660 && startMinutes < 690 && endMinutes !== null && endMinutes > 720);
  if (isNoonSlot) {
    return "NOON";
  }
  if (startMinutes >= 810 && startMinutes < 1050 && (period === "MORNING" || period === "NOON")) {
    return "AFTERNOON";
  }
  if (startMinutes >= 1050 && (period === "MORNING" || period === "NOON")) {
    return "EVENING";
  }
  return period;
};

export const parseTimes = (timeSlot?: string) => {
  if (!timeSlot) return { startTime: null, endTime: null };
  const normalize = (hour: string, minute: string) =>
    `${hour.padStart(2, "0")}:${minute}:00`;
  const rangeMatch = timeSlot.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (rangeMatch) {
    const startHour = Number(rangeMatch[1]);
    const startMinute = Number(rangeMatch[2]);
    const endHour = Number(rangeMatch[3]);
    const endMinute = Number(rangeMatch[4]);
    if (
      startHour > 23 ||
      endHour > 23 ||
      startMinute > 59 ||
      endMinute > 59 ||
      startHour * 60 + startMinute >= endHour * 60 + endMinute
    ) {
      return { startTime: null, endTime: null };
    }
    return {
      startTime: normalize(rangeMatch[1], rangeMatch[2]),
      endTime: normalize(rangeMatch[3], rangeMatch[4]),
    };
  }
  const singleMatch = timeSlot.match(/(\d{1,2}):(\d{2})/);
  if (singleMatch) {
    const startHour = Number(singleMatch[1]);
    const startMinute = Number(singleMatch[2]);
    if (startHour <= 23 && startMinute <= 59) {
      return {
        startTime: normalize(singleMatch[1], singleMatch[2]),
        endTime: null,
      };
    }
  }
  return { startTime: null, endTime: null };
};

export function getCreateTripProposalTool(context: {
  chatId: string;
  userId: string;
  authorization?: string;
  runtime?: PlanningRuntimeState;
}) {
  return tool({
    description:
      "BẮT BUỘC gọi khi người dùng yêu cầu tạo mới HOẶC cập nhật/làm lại toàn bộ lịch trình nhiều ngày. Khi chuyến đi đã có hoạt động mà user muốn làm lại/cập nhật lại toàn bộ lịch trình, đặt commitMode='REPLACE_TRIP_ITEMS' để thay thế sạch thay vì thêm trùng.",
    inputSchema: createTripProposalSchema,
    execute: async (proposalData) => {
      try {
        const proposalId = crypto.randomUUID();

        const dayNumbers = proposalData.days.map((day) => day.dayNumber);
        const uniqueDayNumbers = new Set(dayNumbers);
        const expectedDayNumbers = Array.from(
          { length: proposalData.durationDays },
          (_, index) => index + 1,
        );
        if (
          proposalData.days.length !== proposalData.durationDays ||
          uniqueDayNumbers.size !== dayNumbers.length ||
          expectedDayNumbers.some((day) => !uniqueDayNumbers.has(day))
        ) {
          return {
            success: false,
            errorCode: "INVALID_PROPOSAL_DAYS",
            error: "Số ngày trong lịch trình không hợp lệ.",
          };
        }
        if (
          context.runtime?.brief?.when?.startDate &&
          context.runtime?.brief?.when?.endDate
        ) {
          const start = Date.parse(`${context.runtime.brief.when.startDate}T00:00:00Z`);
          const end = Date.parse(`${context.runtime.brief.when.endDate}T00:00:00Z`);
          if (!Number.isNaN(start) && !Number.isNaN(end)) {
            const authoritativeDuration = Math.floor((end - start) / 86_400_000) + 1;
            if (proposalData.durationDays !== authoritativeDuration) {
              return {
                success: false,
                errorCode: "PROPOSAL_DATE_RANGE_MISMATCH",
                error: "Lịch trình không khớp với khoảng ngày của chuyến đi.",
              };
            }
          }
        } else if (context.runtime?.brief?.when?.durationDays) {
          if (proposalData.durationDays !== context.runtime.brief.when.durationDays) {
            return {
              success: false,
              errorCode: "PROPOSAL_DURATION_MISMATCH",
              error: `Lịch trình phải có độ dài ${context.runtime.brief.when.durationDays} ngày.`,
            };
          }
        }

        const flatActivities: Array<{ placeId?: string; title: string; category?: string }> = [];
        const flatIndexByDayAndActivity: number[][] = [];
        for (const day of proposalData.days) {
          const dayIndices: number[] = [];
          for (const activity of day.activities) {
            dayIndices.push(flatActivities.length);
            flatActivities.push({
              placeId: activity.placeId,
              title: activity.title,
              category: activity.category,
            });
          }
          flatIndexByDayAndActivity.push(dayIndices);
        }

        const resolvedPlaces = await resolveCanonicalActivityPlaces({
          items: flatActivities,
          destinationHint:
            context.runtime?.destinationHint ||
            context.runtime?.brief?.where?.destinationText ||
            proposalData.destination,
          authorization: context.authorization,
          tripId: context.runtime?.tripId,
          store: context.runtime?.placeStore,
        });

        const normalizedDays = proposalData.days.map((day, dayIdx) => ({
          ...day,
          activities: day.activities.map((activity, actIdx) => {
            const canonical = resolvedPlaces.get(flatIndexByDayAndActivity[dayIdx][actIdx]);
            return {
              itemKey: crypto.randomUUID(),
              ...activity,
              period: normalizeActivityPeriod(activity.period, activity.timeSlot),
              placeId: canonical?.id,
              title: canonical?.name || activity.title,
              address: canonical?.address || undefined,
              photoUrl: canonical?.photoUrl || undefined,
              location: canonical?.location || undefined,
            };
          }),
        }));

        const usedPlaceIds = new Set<string>();
        const usedNames = new Set<string>();
        for (const day of normalizedDays) {
          for (const act of day.activities) {
            if (act.placeId) usedPlaceIds.add(act.placeId);
            if (act.title) usedNames.add(act.title);
          }
        }
        const suggestedPlaces = selectComplementarySuggestedPlaces({
          store: context.runtime?.placeStore,
          usedPlaceIds,
          usedNames,
          maxCount: 8,
        });

        const itineraryPayload = {
          id: proposalId,
          title: proposalData.title,
          destination: proposalData.destination,
          durationDays: proposalData.durationDays,
          estimatedBudget: proposalData.estimatedBudget,
          summary: proposalData.summary,
          days: normalizedDays,
          ...(suggestedPlaces.length > 0 ? { suggestedPlaces } : {}),
          createdAt: new Date().toISOString(),
        };
        const proposalHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(itineraryPayload))
          .digest("hex");

        // Persist proposal into PostgreSQL
        await db.insert(proposals).values({
          id: proposalId,
          chatId: context.chatId,
          userId: context.userId,
          itineraryJson: itineraryPayload,
          status: "PENDING",
          proposalHash,
        });

        let autoCommit:
          | {
              status: "APPLIED";
              action: "ADD_TO_TRIP" | "REPLACE_DAYS" | "REPLACE_TRIP_ITEMS";
              operationId: string;
              tripId: string;
              appliedCount: number;
              committedItemKeys: string[];
            }
          | { status: "FAILED_RETRYABLE"; safeErrorCode: string }
          | undefined;

        if (
          context.runtime?.autoCommitAuthorized &&
          context.runtime.tripId &&
          context.runtime.runId &&
          context.authorization
        ) {
          const items: TripCommitItem[] = normalizedDays.flatMap((day) =>
            day.activities.map((activity) => ({
              sourceItemKey: activity.itemKey,
              dayNumber: day.dayNumber,
              title: activity.title,
              itemType: itemType(activity.category),
              placeRef: activity.placeId || null,
              ...parseTimes(activity.timeSlot),
              notes: activity.description || null,
            })),
          );
          const resolvedCommit = resolveProposalCommitAction({
            explicitMode: proposalData.commitMode,
            dayNumbers,
            hasTripItems: context.runtime.hasTripItems,
            tripDaysCount: context.runtime.tripDaysCount,
          });
          try {
            const result = await commitTripMutation({
              authorization: context.authorization,
              userId: context.userId,
              idempotencyKey: deterministicCommitKey(
                context.chatId,
                proposalId,
                resolvedCommit.action,
              ),
              request: {
                action: resolvedCommit.action,
                targetTripId: context.runtime.tripId,
                proposalId,
                proposalHash,
                expectedTripRevision: context.runtime.tripRevision ?? null,
                tripDraft: null,
                items,
                ...(resolvedCommit.replaceDayNumbers
                  ? { replaceDayNumbers: resolvedCommit.replaceDayNumbers }
                  : {}),
              },
            });
            context.runtime.tripRevision = result.tripRevision;
            context.runtime.hasTripItems = true;
            await db
              .update(proposals)
              .set({
                status: "APPLIED",
                appliedTripId: result.tripId,
                appliedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(proposals.id, proposalId));
            autoCommit = {
              status: "APPLIED",
              action: resolvedCommit.action,
              operationId: result.operationId,
              tripId: result.tripId,
              appliedCount: result.appliedCount,
              committedItemKeys: result.items.map((item) => item.itemKey),
            };
            if (context.runtime.state && context.runtime.stateMessageId) {
              const completedState = {
                ...context.runtime.state,
                status: "COMPLETED" as const,
                tripId: result.tripId,
                safeErrorCode: undefined,
              };
              await db
                .update(messages)
                .set({
                  parts: [
                    { type: "text", text: context.runtime.userText || "" },
                    completedState,
                  ],
                })
                .where(eq(messages.id, context.runtime.stateMessageId));
              context.runtime.state = completedState;
              context.runtime.autoCommitAuthorized = false;
            }
          } catch (error) {
            autoCommit = {
              status: "FAILED_RETRYABLE",
              safeErrorCode:
                error instanceof Error && error.message.startsWith("TRIP_")
                  ? error.message
                  : "TRIP_COMMIT_FAILED",
            };
            if (context.runtime.state && context.runtime.stateMessageId) {
              const failedState = {
                ...context.runtime.state,
                status: "FAILED_RETRYABLE" as const,
                safeErrorCode: autoCommit.safeErrorCode,
              };
              await db
                .update(messages)
                .set({
                  parts: [
                    { type: "text", text: context.runtime.userText || "" },
                    failedState,
                  ],
                })
                .where(eq(messages.id, context.runtime.stateMessageId));
              context.runtime.state = failedState;
            }
          }
        }

        return {
          success: true,
          proposalId,
          proposalHash,
          status: autoCommit?.status === "APPLIED" ? "APPLIED" : "PENDING",
          autoCommit,
          ...itineraryPayload,
        };
      } catch (err) {
        console.error("Failed to persist trip proposal:", err);
        return {
          success: false,
          error: "Không thể lưu bản thảo lịch trình lúc này.",
        };
      }
    },
  });
}
