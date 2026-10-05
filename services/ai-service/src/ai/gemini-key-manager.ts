import { config } from "../config.js";

export interface CachedGeminiKey {
  rawKey: string;
  maskedKey: string;
  keyHash?: string;
  expiresAt: number;
}

export class GeminiKeyManager {
  private cachedKey: CachedGeminiKey | null = null;
  private readonly ttlMs: number;
  private lastReportedSuccessAt: number = 0;

  constructor(ttlMs = 60_000) {
    this.ttlMs = ttlMs;
  }

  /**
   * Helper to mask a key for safe logging (never print full secret).
   */
  public static maskKey(key: string | null | undefined): string {
    if (!key) return "empty";
    if (key.length <= 10) return "***";
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  /**
   * Gets the active Gemini API Key.
   * Priority:
   * 1. In-memory cache (if valid and not expired)
   * 2. Query place-service /api/places/internal/keys/active-raw?provider=GEMINI
   * 3. Fallback to process.env.GOOGLE_GENERATIVE_AI_API_KEY
   */
  public async getActiveKey(): Promise<string> {
    const now = Date.now();
    if (this.cachedKey && this.cachedKey.expiresAt > now && this.cachedKey.rawKey) {
      return this.cachedKey.rawKey;
    }

    try {
      const baseUrl = config.placeServiceUrl || "http://localhost:8083";
      const url = `${baseUrl}/api/places/internal/keys/active-raw?provider=GEMINI`;

      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const body = (await response.json()) as {
          success?: boolean;
          data?: {
            provider?: string;
            key?: string;
            maskedKey?: string;
            keyHash?: string;
          };
        };

        if (body?.success && body.data?.key) {
          const rawKey = body.data.key.trim();
          this.cachedKey = {
            rawKey,
            maskedKey: body.data.maskedKey || GeminiKeyManager.maskKey(rawKey),
            keyHash: body.data.keyHash,
            expiresAt: now + this.ttlMs,
          };
          console.info(`[GeminiKeyManager] Successfully retrieved dynamic active key from place-service: ${this.cachedKey.maskedKey}`);
          return rawKey;
        }
      } else {
        console.warn(`[GeminiKeyManager] place-service returned HTTP ${response.status} (${response.statusText}). Falling back to .env key.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GeminiKeyManager] Failed to fetch active key from place-service: ${msg}. Using env fallback.`);
    }

    // Graceful fallback to static env key
    const fallback = config.googleApiKey;
    if (fallback) {
      this.cachedKey = {
        rawKey: fallback,
        maskedKey: GeminiKeyManager.maskKey(fallback),
        expiresAt: now + this.ttlMs,
      };
      console.info(`[GeminiKeyManager] Using static fallback key from .env: ${this.cachedKey.maskedKey}`);
      return fallback;
    }

    throw new Error("No Gemini API key available (both place-service Token Pool and GOOGLE_GENERATIVE_AI_API_KEY are missing).");
  }

  /**
   * Clears cache and reports failure to place-service for auto-rotation.
   */
  public async reportFailure(
    failedKey: string,
    statusCode?: number,
    reason?: string
  ): Promise<string | null> {
    this.cachedKey = null; // Invalidate cache immediately

    const isQuotaOrAuth =
      statusCode === 429 ||
      statusCode === 401 ||
      statusCode === 403 ||
      (reason && /quota|exhausted|rate limit|api key not valid/i.test(reason));

    if (!isQuotaOrAuth) {
      return null;
    }

    try {
      const baseUrl = config.placeServiceUrl || "http://localhost:8083";
      const url = `${baseUrl}/api/places/internal/keys/rotate`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "GEMINI",
          failedKey,
          status: statusCode === 429 ? "EXHAUSTED" : "INVALID",
          reason: reason || `Error ${statusCode}`,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        const body = (await response.json()) as {
          success?: boolean;
          data?: {
            rotated?: boolean;
            newActiveKey?: string;
            newMaskedKey?: string;
          };
        };

        if (body?.success && body.data?.newActiveKey) {
          const newKey = body.data.newActiveKey;
          this.cachedKey = {
            rawKey: newKey,
            maskedKey: body.data.newMaskedKey || GeminiKeyManager.maskKey(newKey),
            expiresAt: Date.now() + this.ttlMs,
          };
          console.info(`[GeminiKeyManager] Key successfully auto-rotated to: ${this.cachedKey.maskedKey}`);
          return newKey;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GeminiKeyManager] Failed to notify place-service of key rotation: ${msg}`);
    }

    return null;
  }

  /**
   * Reports success throttled to avoid spamming place-service on every chunk/message.
   */
  public reportSuccess(rawKey: string): void {
    const now = Date.now();
    // Throttle to at most once per 10 seconds
    if (now - this.lastReportedSuccessAt < 10_000) {
      return;
    }
    this.lastReportedSuccessAt = now;

    const baseUrl = config.placeServiceUrl || "http://localhost:8083";
    const url = `${baseUrl}/api/places/internal/keys/record-success`;

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "GEMINI", rawKey }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {
      // Ignore background metric recording errors
    });
  }

  /**
   * Force invalidate cache (useful for testing or admin notifications)
   */
  public invalidateCache(): void {
    this.cachedKey = null;
  }

  /**
   * Returns current cached key state for inspection
   */
  public getCachedState(): CachedGeminiKey | null {
    return this.cachedKey;
  }
}

export const geminiKeyManager = new GeminiKeyManager();
