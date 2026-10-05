import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { TripIntakeCard } from "../trip-intake-card";
import type { TripBriefState } from "@/features/ai-trip-commit/types";

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "vi",
  }),
}));

// Mock useActiveChat
vi.mock("@/hooks/use-active-chat", () => ({
  useActiveChat: () => ({
    chatId: "test-chat-1",
    sendMessage: vi.fn(),
  }),
}));

// Mock api
vi.mock("@/features/ai-trip-commit/services/ai-trip-commit-api", () => ({
  patchPlanningBrief: vi.fn(),
  cancelPlanningBrief: vi.fn(),
}));

describe("TripIntakeCard Component", () => {
  it("renders active intake card at WHERE step with popular destinations", () => {
    const state: TripBriefState = {
      type: "data-tripBrief",
      runId: "run-1",
      intentMessageId: "msg-1",
      version: 1,
      status: "COLLECTING",
      brief: {},
      missingFields: ["WHERE", "WHEN", "WHO", "BUDGET"],
      nextQuestion: "WHERE",
    };

    const html = renderToString(
      <TripIntakeCard chatId="test-chat-1" initialState={state} />
    );

    expect(html).toContain("aiPlanner.intake.title");
    expect(html).toContain("aiPlanner.intake.whereTitle");
    expect(html).toContain("Đà Nẵng");
    expect(html).toContain("Hà Nội");
    expect(html).toContain("aiPlanner.intake.whereOther");
  });

  it("renders active intake card at WHEN step with weekend presets", () => {
    const state: TripBriefState = {
      type: "data-tripBrief",
      runId: "run-1",
      intentMessageId: "msg-1",
      version: 2,
      status: "COLLECTING",
      brief: {
        where: { destinationText: "Đà Nẵng" },
      },
      missingFields: ["WHEN", "WHO", "BUDGET"],
      nextQuestion: "WHEN",
    };

    const html = renderToString(
      <TripIntakeCard chatId="test-chat-1" initialState={state} />
    );

    expect(html).toContain("aiPlanner.intake.whenTitle");
    expect(html).toContain("aiPlanner.intake.thisWeekend");
    expect(html).toContain("aiPlanner.intake.nextWeekend");
    expect(html).toContain("aiPlanner.intake.nextWeek");
    expect(html).toContain("aiPlanner.intake.customDates");
  });

  it("renders completed trip linked state with green check summary", () => {
    const state: TripBriefState = {
      type: "data-tripBrief",
      runId: "run-1",
      intentMessageId: "msg-1",
      version: 5,
      status: "TRIP_LINKED",
      tripId: "trip-uuid-1",
      brief: {
        where: { destinationText: "Đà Nẵng" },
        when: { startDate: "2026-10-10", endDate: "2026-10-12" },
        who: { adults: 2, children: 0, infants: 0, pets: 0 },
        budget: { mode: "FLEXIBLE" },
      },
      missingFields: [],
    };

    const html = renderToString(
      <TripIntakeCard chatId="test-chat-1" initialState={state} />
    );

    expect(html).toContain("aiPlanner.intake.tripLinked");
    expect(html).toContain("aiPlanner.intake.generateAction");
    expect(html).toContain("Đà Nẵng");
    expect(html).toContain("2026-10-10");
    expect(html).toContain("aiPlanner.intake.budgetFlexible");
  });

  it("renders cancelled note when intake was cancelled", () => {
    const state: TripBriefState = {
      type: "data-tripBrief",
      runId: "run-1",
      intentMessageId: "msg-1",
      version: 3,
      status: "CANCELLED",
      brief: {
        where: { destinationText: "Hà Nội" },
      },
      missingFields: ["WHEN", "WHO", "BUDGET"],
    };

    const html = renderToString(
      <TripIntakeCard chatId="test-chat-1" initialState={state} />
    );

    expect(html).toContain("aiPlanner.intake.cancelled");
  });
});
