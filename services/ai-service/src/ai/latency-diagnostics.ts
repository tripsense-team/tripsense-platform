export interface PrefetchLatencyMeta {
  ran: boolean;
  durationMs: number;
  timedOut: boolean;
  count: number;
  recommendationCount: number;
  fallbackTriggered: boolean;
}

export interface StepLatencyMeta {
  step: number;
  durationMs: number;
  tools: string[];
  inputTokens?: number;
  outputTokens?: number;
}

export interface ToolLatencyMeta {
  name: string;
  durationMs: number;
  ok: boolean;
}

export interface ChatLatencySummary {
  chatId: string;
  modelId: string;
  outcome: "ok" | "error";
  preflightMs: number;
  prefetch: PrefetchLatencyMeta;
  firstChunkMs: number | null;
  firstTextMs: number | null;
  totalMs: number;
  steps: StepLatencyMeta[];
  tools: ToolLatencyMeta[];
}

export interface ChatLatencyTracker {
  markPreflightComplete(): void;
  recordPrefetch(meta: PrefetchLatencyMeta): void;
  onChunk(chunkType: string): void;
  onStepStart(stepNumber: number): void;
  onStepEnd(params: {
    stepNumber: number;
    toolNames: string[];
    inputTokens?: number;
    outputTokens?: number;
  }): void;
  onToolExecutionEnd(params: {
    toolName: string;
    durationMs: number;
    ok: boolean;
  }): void;
  markError(): void;
  buildSummary(): ChatLatencySummary;
  formatLogLine(): string;
  emit(logger?: (line: string) => void): void;
}

/**
 * Lightweight per-request timing tracker for AI chat SSE turns.
 * Logs only numeric timings, step/tool names, and token counts (never user prompts, tokens, or PII).
 */
export function createChatLatencyTracker(params: {
  chatId: string;
  modelId: string;
  enabled?: boolean;
  now?: () => number;
}): ChatLatencyTracker {
  const now = params.now ?? (() => Date.now());
  const enabled = params.enabled ?? true;
  const startedAt = now();

  let preflightMs = 0;
  let prefetch: PrefetchLatencyMeta = {
    ran: false,
    durationMs: 0,
    timedOut: false,
    count: 0,
    recommendationCount: 0,
    fallbackTriggered: false,
  };
  let firstChunkMs: number | null = null;
  let firstTextMs: number | null = null;
  let outcome: "ok" | "error" = "ok";
  let emitted = false;

  const stepStarts = new Map<number, number>();
  const steps: StepLatencyMeta[] = [];
  const tools: ToolLatencyMeta[] = [];

  const elapsed = () => Math.max(0, Math.round(now() - startedAt));

  return {
    markPreflightComplete() {
      preflightMs = elapsed();
    },

    recordPrefetch(meta) {
      prefetch = {
        ...meta,
        durationMs: Math.max(0, Math.round(meta.durationMs)),
      };
    },

    onChunk(chunkType) {
      const current = elapsed();
      if (firstChunkMs === null) {
        firstChunkMs = current;
      }
      if (chunkType === "text-delta" && firstTextMs === null) {
        firstTextMs = current;
      }
    },

    onStepStart(stepNumber) {
      stepStarts.set(stepNumber, now());
    },

    onStepEnd({ stepNumber, toolNames, inputTokens, outputTokens }) {
      const stepStart = stepStarts.get(stepNumber) ?? startedAt;
      stepStarts.delete(stepNumber);
      steps.push({
        step: stepNumber,
        durationMs: Math.max(0, Math.round(now() - stepStart)),
        tools: toolNames,
        ...(typeof inputTokens === "number" ? { inputTokens } : {}),
        ...(typeof outputTokens === "number" ? { outputTokens } : {}),
      });
    },

    onToolExecutionEnd({ toolName, durationMs, ok }) {
      tools.push({
        name: toolName,
        durationMs: Math.max(0, Math.round(durationMs)),
        ok,
      });
    },

    markError() {
      outcome = "error";
    },

    buildSummary() {
      return {
        chatId: params.chatId,
        modelId: params.modelId,
        outcome,
        preflightMs,
        prefetch,
        firstChunkMs,
        firstTextMs,
        totalMs: elapsed(),
        steps: [...steps],
        tools: [...tools],
      };
    },

    formatLogLine() {
      const s = this.buildSummary();
      const prefetchText = s.prefetch.ran
        ? `ran(ms=${s.prefetch.durationMs},timedOut=${s.prefetch.timedOut},count=${s.prefetch.count},rec=${s.prefetch.recommendationCount},fb=${s.prefetch.fallbackTriggered})`
        : "skip";
      const stepsText = s.steps
        .map((st) => {
          const tokens =
            typeof st.inputTokens === "number" || typeof st.outputTokens === "number"
              ? `,tok=${st.inputTokens ?? "?"}/${st.outputTokens ?? "?"}`
              : "";
          const toolTag = st.tools.length > 0 ? st.tools.join("+") : "text";
          return `${st.step}:${st.durationMs}ms(${toolTag}${tokens})`;
        })
        .join(",");
      const toolsText = s.tools
        .map((t) => `${t.name}:${t.durationMs}ms(${t.ok ? "ok" : "err"})`)
        .join(",");

      return `[ai-latency] chatId=${s.chatId} model=${s.modelId} outcome=${s.outcome} preflightMs=${s.preflightMs} prefetch=${prefetchText} firstChunkMs=${s.firstChunkMs ?? "null"} firstTextMs=${s.firstTextMs ?? "null"} totalMs=${s.totalMs} steps=[${stepsText}] tools=[${toolsText}]`;
    },

    emit(logger = console.info) {
      if (!enabled || emitted) return;
      emitted = true;
      logger(this.formatLogLine());
    },
  };
}
