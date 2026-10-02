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
import type { PlanningRuntimeState } from "./update-trip-planning-brief.js";

const activitySchema = z.object({
  period: z
    .enum(["MORNING", "AFTERNOON", "EVENING", "FLEXIBLE"])
    .describe("Buổi trong ngày để frontend trình bày nhất quán"),
  timeSlot: z
    .string().max(80)
    .describe("Khung giờ gợi ý (ví dụ: '08:00 - 10:30', '12:00 - 13:30', '19:00 - 21:00')"),
  title: z
    .string().trim().min(1).max(200)
    .describe("Tên hoạt động hoặc địa điểm (ví dụ: 'Check-in Chùa Linh Ứng', 'Ăn trưa Bánh tráng cuốn thịt heo')"),
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
    .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "ACTIVITY"])
    .describe("Loại hoạt động"),
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
  days: z
    .array(dayPlanSchema)
    .min(1)
    .describe("Kế hoạch chi tiết theo từng ngày"),
});

type CanonicalPlace = {
  id: string;
  name?: string;
  address?: string;
};

const requiresCanonicalPlace = (category?: string) =>
  category === "ATTRACTION" ||
  category === "FOOD" ||
  category === "CAFE" ||
  category === "STAY";

const itemType = (category?: string): TripCommitItem["itemType"] => {
  if (category === "FOOD" || category === "CAFE") return "MEAL";
  if (category === "STAY") return "HOTEL";
  if (category === "ATTRACTION") return "PLACE";
  return "ACTIVITY";
};

const parseTimes = (timeSlot?: string) => {
  const matches = timeSlot?.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!matches) return { startTime: null, endTime: null };
  const startHour = Number(matches[1]);
  const startMinute = Number(matches[2]);
  const endHour = Number(matches[3]);
  const endMinute = Number(matches[4]);
  if (
    startHour > 23 ||
    endHour > 23 ||
    startMinute > 59 ||
    endMinute > 59 ||
    startHour * 60 + startMinute >= endHour * 60 + endMinute
  ) {
    return { startTime: null, endTime: null };
  }
  const normalize = (hour: string, minute: string) =>
    `${hour.padStart(2, "0")}:${minute}:00`;
  return {
    startTime: normalize(matches[1], matches[2]),
    endTime: normalize(matches[3], matches[4]),
  };
};

async function canonicalSnapshots(ids: string[]): Promise<Map<string, CanonicalPlace> | null> {
  if (ids.length === 0) return new Map();
  let response: Response;
  try {
    response = await fetch(`${config.placeServiceUrl}/api/places/batch-snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(ids),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: CanonicalPlace[] };
  const snapshots = Array.isArray(payload.data) ? payload.data : [];
  const byId = new Map(snapshots.filter((place) => place?.id).map((place) => [place.id, place]));
  return ids.every((id) => byId.has(id)) ? byId : null;
}

export function getCreateTripProposalTool(context: {
  chatId: string;
  userId: string;
  authorization?: string;
  runtime?: PlanningRuntimeState;
}) {
  return tool({
    description:
      "Tạo lịch trình có cấu trúc từ các địa điểm canonical. Trong intake đã được ủy quyền, hệ thống tự lưu vào Trip; ngoài intake, proposal vẫn chờ người dùng xác nhận.",
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
        if (context.runtime?.brief?.when) {
          const start = Date.parse(`${context.runtime.brief.when.startDate}T00:00:00Z`);
          const end = Date.parse(`${context.runtime.brief.when.endDate}T00:00:00Z`);
          const authoritativeDuration = Math.floor((end - start) / 86_400_000) + 1;
          if (proposalData.durationDays !== authoritativeDuration) {
            return {
              success: false,
              errorCode: "PROPOSAL_DATE_RANGE_MISMATCH",
              error: "Lịch trình không khớp với khoảng ngày của chuyến đi.",
            };
          }
        }

        const placeLikeActivities = proposalData.days.flatMap((day) =>
          day.activities.filter((activity) => requiresCanonicalPlace(activity.category)),
        );
        if (placeLikeActivities.some((activity) => !activity.placeId)) {
          return {
            success: false,
            errorCode: "CANONICAL_PLACE_REQUIRED",
            error: "Không đủ địa điểm đã được xác thực để tạo lịch trình.",
          };
        }
        const placeIds = [...new Set(placeLikeActivities.map((activity) => activity.placeId!))];
        const snapshots = await canonicalSnapshots(placeIds);
        if (!snapshots) {
          return {
            success: false,
            errorCode: "CANONICAL_PLACE_UNAVAILABLE",
            error: "Không thể xác thực đầy đủ các địa điểm trong lịch trình.",
          };
        }

        const normalizedDays = proposalData.days.map((day) => ({
          ...day,
          activities: day.activities.map((activity) => {
            const snapshot = activity.placeId ? snapshots.get(activity.placeId) : undefined;
            return {
              itemKey: crypto.randomUUID(),
              ...activity,
              title: snapshot?.name || activity.title,
              address: snapshot?.address || undefined,
            };
          }),
        }));

        const itineraryPayload = {
          id: proposalId,
          title: proposalData.title,
          destination: proposalData.destination,
          durationDays: proposalData.durationDays,
          estimatedBudget: proposalData.estimatedBudget,
          summary: proposalData.summary,
          days: normalizedDays,
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
          try {
            const result = await commitTripMutation({
              authorization: context.authorization,
              userId: context.userId,
              idempotencyKey: deterministicCommitKey(
                context.chatId,
                proposalId,
                "ADD_TO_TRIP",
              ),
              request: {
                action: "ADD_TO_TRIP",
                targetTripId: context.runtime.tripId,
                proposalId,
                proposalHash,
                expectedTripRevision: context.runtime.tripRevision ?? null,
                tripDraft: null,
                items,
              },
            });
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
