import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reduceAgentActivities, upsertAgentActivity } from "./agent-activity";
import { AgentActivityPanel } from "./agent-activity-panel";
import type { AgentActivity } from "./types";

const base: AgentActivity = {
  schemaVersion: 1,
  activityId: "run:search:1",
  stage: "SEARCH",
  kind: "SEARCHING_PLACES",
  status: "RUNNING",
  label: "Searching for places",
  startedAt: "2026-09-21T00:00:00Z",
  updatedAt: "2026-09-21T00:00:00Z",
};

describe("upsertAgentActivity & reduceAgentActivities", () => {
  it("updates a stable activity and prevents terminal state regression", () => {
    const completed: AgentActivity = {
      ...base,
      status: "COMPLETED",
      label: "Found 12 places",
      updatedAt: "2026-09-21T00:00:02Z",
      completedAt: "2026-09-21T00:00:02Z",
    };
    const result = upsertAgentActivity(upsertAgentActivity([], base), completed);
    expect(result).toEqual([completed]);

    // Terminal state cannot regress to RUNNING
    const replayed = upsertAgentActivity(result, base);
    expect(replayed).toEqual(result);
  });

  it("preserves initial startedAt timestamp across updates", () => {
    const skewedStarted: AgentActivity = {
      ...base,
      status: "COMPLETED",
      label: "Completed",
      startedAt: "2026-09-21T00:00:05Z",
      updatedAt: "2026-09-21T00:00:05Z",
    };
    const result = upsertAgentActivity([base], skewedStarted);
    expect(result[0].startedAt).toBe("2026-09-21T00:00:00Z");
  });

  it("ignores incoming updates with older updatedAt timestamps", () => {
    const current: AgentActivity = {
      ...base,
      label: "Step 2",
      updatedAt: "2026-09-21T00:00:10Z",
    };
    const older: AgentActivity = {
      ...base,
      label: "Step 1",
      updatedAt: "2026-09-21T00:00:05Z",
    };
    const result = upsertAgentActivity([current], older);
    expect(result[0].label).toBe("Step 2");
  });

  it("reduces a stream of activities cleanly across stages", () => {
    const act1Start: AgentActivity = {
      schemaVersion: 1,
      activityId: "run:understand:1",
      stage: "UNDERSTAND",
      kind: "UNDERSTANDING_REQUEST",
      status: "RUNNING",
      label: "Understanding request",
      startedAt: "2026-09-21T00:00:00Z",
      updatedAt: "2026-09-21T00:00:00Z",
    };
    const act1Done: AgentActivity = {
      ...act1Start,
      status: "COMPLETED",
      label: "Understood request",
      updatedAt: "2026-09-21T00:00:01Z",
      completedAt: "2026-09-21T00:00:01Z",
    };
    const act2Start: AgentActivity = {
      schemaVersion: 1,
      activityId: "run:search:2",
      stage: "SEARCH",
      kind: "SEARCHING_PLACES",
      status: "RUNNING",
      label: "Searching places",
      startedAt: "2026-09-21T00:00:02Z",
      updatedAt: "2026-09-21T00:00:02Z",
    };

    const reduced = reduceAgentActivities([act1Start, act1Done, act2Start]);
    expect(reduced.length).toBe(2);
    expect(reduced[0].status).toBe("COMPLETED");
    expect(reduced[1].status).toBe("RUNNING");
  });
});

describe("AgentActivityPanel", () => {
  it("renders null when activities array is empty", () => {
    const html = renderToStaticMarkup(<AgentActivityPanel activities={[]} />);
    expect(html).toBe("");
  });

  it("renders active running activity with accessible polite announcement", () => {
    const html = renderToStaticMarkup(
      <AgentActivityPanel
        activities={[
          {
            schemaVersion: 1,
            activityId: "run:search:1",
            stage: "SEARCH",
            kind: "SEARCHING_PLACES",
            status: "RUNNING",
            label: "Searching for coffee in Da Nang",
            summary: "Scanning verified cafes.",
            startedAt: "2026-09-21T00:00:00Z",
            updatedAt: "2026-09-21T00:00:00Z",
          },
        ]}
      />
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Searching for coffee in Da Nang");
    expect(html).toContain("Scanning verified cafes.");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("renders completed and failed history steps in a collapsed disclosure", () => {
    const html = renderToStaticMarkup(
      <AgentActivityPanel
        activities={[
          {
            schemaVersion: 1,
            activityId: "run:understand:1",
            stage: "UNDERSTAND",
            kind: "UNDERSTANDING_REQUEST",
            status: "COMPLETED",
            label: "Understood request",
            startedAt: "2026-09-21T00:00:00Z",
            updatedAt: "2026-09-21T00:00:01Z",
          },
          {
            schemaVersion: 1,
            activityId: "run:search:2",
            stage: "SEARCH",
            kind: "SEARCHING_PLACES",
            status: "FAILED",
            label: "Search was unavailable",
            summary: "Using cached places.",
            startedAt: "2026-09-21T00:00:02Z",
            updatedAt: "2026-09-21T00:00:03Z",
          },
        ]}
      />
    );
    expect(html).toContain("<details");
    expect(html).toContain("2 steps completed");
    expect(html).toContain("Understood request");
    expect(html).toContain("Search was unavailable");
    expect(html).toContain("Using cached places.");
  });

  it("does not render completed-only activity history in the final answer", () => {
    const html = renderToStaticMarkup(
      <AgentActivityPanel
        activities={[{
          ...base,
          status: "COMPLETED",
          label: " ",
          completedAt: "2026-09-21T00:00:01Z",
        }]}
      />
    );
    expect(html).toBe("");
  });
});
