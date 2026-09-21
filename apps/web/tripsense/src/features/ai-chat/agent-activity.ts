import type { AgentActivity } from "./types";

const terminal = new Set(["COMPLETED", "FAILED", "SKIPPED"]);

export function upsertAgentActivity(items: AgentActivity[] = [], incoming: AgentActivity): AgentActivity[] {
  const index = items.findIndex((item) => item.activityId === incoming.activityId);
  if (index < 0) return [...items, incoming];
  const current = items[index];
  if (terminal.has(current.status) && incoming.status === "RUNNING") return items;
  const incomingTime = Date.parse(incoming.updatedAt);
  const currentTime = Date.parse(current.updatedAt);
  if (incomingTime < currentTime) return items;
  if (incomingTime === currentTime && terminal.has(current.status) && incoming.status === "RUNNING") return items;
  const next = [...items];
  next[index] = { ...incoming, startedAt: current.startedAt || incoming.startedAt };
  return next;
}

export function reduceAgentActivities(activities: AgentActivity[] = []): AgentActivity[] {
  return activities.reduce<AgentActivity[]>((acc, item) => upsertAgentActivity(acc, item), []);
}
