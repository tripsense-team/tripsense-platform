import assert from "node:assert/strict";
import test from "node:test";
import { createChatLatencyTracker } from "./latency-diagnostics.js";

test("createChatLatencyTracker records milestones and formats zero-leak log line once", () => {
  let clock = 1000;
  const tracker = createChatLatencyTracker({
    chatId: "chat-latency-1",
    modelId: "gemini-3.8-flash",
    enabled: true,
    now: () => clock,
  });

  clock = 1120;
  tracker.recordPrefetch({
    ran: true,
    durationMs: 95,
    timedOut: false,
    count: 18,
    recommendationCount: 15,
    fallbackTriggered: false,
  });
  tracker.markPreflightComplete();

  clock = 1350;
  tracker.onStepStart(0);
  clock = 1850;
  tracker.onToolExecutionEnd({
    toolName: "createTripProposal",
    durationMs: 240,
    ok: true,
  });
  tracker.onStepEnd({
    stepNumber: 0,
    toolNames: ["createTripProposal"],
    inputTokens: 920,
    outputTokens: 480,
  });

  clock = 2100;
  tracker.onChunk("step-start");
  clock = 2250;
  tracker.onChunk("text-delta");

  const summary = tracker.buildSummary();
  assert.equal(summary.preflightMs, 120);
  assert.equal(summary.firstChunkMs, 1100);
  assert.equal(summary.firstTextMs, 1250);
  assert.equal(summary.steps.length, 1);
  assert.equal(summary.steps[0].durationMs, 500);
  assert.equal(summary.tools.length, 1);
  assert.equal(summary.tools[0].durationMs, 240);

  const emitted: string[] = [];
  tracker.emit((line) => emitted.push(line));
  tracker.emit((line) => emitted.push(line));

  assert.equal(emitted.length, 1);
  assert.match(emitted[0], /^\[ai-latency\] chatId=chat-latency-1 model=gemini-3\.8-flash outcome=ok/);
  assert.match(emitted[0], /prefetch=ran\(ms=95,timedOut=false,count=18,rec=15,fb=false\)/);
  assert.match(emitted[0], /firstTextMs=1250/);
  assert.match(emitted[0], /steps=\[0:500ms\(createTripProposal,tok=920\/480\)\]/);
  assert.match(emitted[0], /tools=\[createTripProposal:240ms\(ok\)\]/);
});

test("createChatLatencyTracker skips emitting when disabled and marks error outcome", () => {
  let clock = 500;
  const tracker = createChatLatencyTracker({
    chatId: "chat-err-1",
    modelId: "gemini-3.8-flash",
    enabled: false,
    now: () => clock,
  });
  clock = 700;
  tracker.markError();
  const line = tracker.formatLogLine();
  assert.match(line, /outcome=error/);
  assert.match(line, /prefetch=skip/);

  const emitted: string[] = [];
  tracker.emit((l) => emitted.push(l));
  assert.equal(emitted.length, 0);
});
