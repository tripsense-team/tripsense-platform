import type {
  RecommendationBatchEvent,
  WeakRecommendationEventType,
} from "./recommendations-api";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_QUEUE_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 500;

export interface QueueRecommendationFeedback {
  recommendationId: string;
  placeId: string;
  eventType: WeakRecommendationEventType;
  position: number;
}

type BatchSender = (
  events: RecommendationBatchEvent[],
  keepalive: boolean,
) => Promise<unknown>;

interface BufferOptions {
  batchSize?: number;
  maxQueueSize?: number;
  flushIntervalMs?: number;
  retryDelayMs?: number;
}

export class RecommendationFeedbackBuffer {
  private readonly batchSize: number;
  private readonly maxQueueSize: number;
  private readonly flushIntervalMs: number;
  private readonly retryDelayMs: number;
  private readonly queue: RecommendationBatchEvent[] = [];
  private readonly queuedSemanticKeys = new Set<string>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private flightGeneration = 0;
  private disposed = false;

  constructor(
    private readonly send: BatchSender,
    options: BufferOptions = {},
  ) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  enqueue(input: QueueRecommendationFeedback): boolean {
    if (this.disposed) return false;
    const semanticKey = this.semanticKey(input);
    if (this.queuedSemanticKeys.has(semanticKey)) return false;
    if (this.queue.length >= this.maxQueueSize) return false;

    this.queuedSemanticKeys.add(semanticKey);
    this.queue.push({
      ...input,
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
    });
    this.armTimer();
    if (this.queue.length >= this.batchSize) void this.flush();
    return true;
  }

  flush(keepalive = false): Promise<void> {
    this.clearTimer();
    if (this.queue.length === 0) return this.inFlight ?? Promise.resolve();
    const batches: RecommendationBatchEvent[][] = [];
    while (this.queue.length > 0) {
      batches.push(this.queue.splice(0, this.batchSize));
    }
    const previous = this.inFlight ?? Promise.resolve();
    const work = previous.then(async () => {
      for (const batch of batches) {
        try {
          await this.sendWithRetry(batch, keepalive);
        } catch {
          // Feedback is best-effort. Stable IDs are reused for the one bounded retry.
        }
      }
    });
    const generation = ++this.flightGeneration;
    const tracked = work.finally(() => {
      if (this.flightGeneration === generation) {
        this.inFlight = null;
        if (!this.disposed && this.queue.length > 0) this.armTimer();
      }
    });
    this.inFlight = tracked;
    return tracked;
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private async sendWithRetry(
    batch: RecommendationBatchEvent[],
    keepalive: boolean,
  ): Promise<void> {
    try {
      await this.send(batch, keepalive);
    } catch (error) {
      if (keepalive || this.disposed) throw error;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      await this.send(batch, false);
    }
  }

  private armTimer(): void {
    if (this.flushTimer || this.queue.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.flushIntervalMs);
  }

  private clearTimer(): void {
    if (!this.flushTimer) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private semanticKey(input: QueueRecommendationFeedback): string {
    return `${input.recommendationId}:${input.placeId}:${input.eventType}`;
  }
}
