import { config } from "../config.js";

export interface CachedGeminiKey {
  rawKey: string;
  maskedKey: string;
  keyHash?: string;
  source: "env" | "pool";
  expiresAt: number;
}

export class GeminiKeyManager {
  private cachedKey: CachedGeminiKey | null = null;
  private readonly ttlMs: number;
  private readonly baseUrl?: string;
  private readonly envKeyOverride?: string;
  private lastReportedSuccessAt: number = 0;

  constructor(ttlMs = 60_000, baseUrl?: string, envKeyOverride?: string) {
    this.ttlMs = ttlMs;
    this.baseUrl = baseUrl;
    this.envKeyOverride = envKeyOverride;
  }

  private getConfiguredEnvKey(): string {
    const candidate = this.envKeyOverride !== undefined ? this.envKeyOverride : config.googleApiKey;
    return candidate.trim();
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
   * Gets the active Gemini API Key for AI Chat.
   * Priority:
   * 1. In-memory cache (if valid and not expired)
   * 2. Explicit GOOGLE_GENERATIVE_AI_API_KEY from environment
   * 3. Fallback to place-service /api/places/internal/keys/active-raw?provider=GEMINI
   */
  public async getActiveKey(): Promise<string> {
    const now = Date.now();
    if (this.cachedKey && this.cachedKey.expiresAt > now && this.cachedKey.rawKey) {
      return this.cachedKey.rawKey;
    }

    const envKey = this.getConfiguredEnvKey();
    if (envKey) {
      this.cachedKey = {
        rawKey: envKey,
        maskedKey: GeminiKeyManager.maskKey(envKey),
        source: "env",
        expiresAt: now + this.ttlMs,
      };
      console.info(
        `[GeminiKeyManager] Using GOOGLE_GENERATIVE_AI_API_KEY from .env: ${this.cachedKey.maskedKey}`
      );
      return envKey;
    }

    try {
      const baseUrl = this.baseUrl || config.placeServiceUrl || "http://localhost:8083";
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
            source: "pool",
            expiresAt: now + this.ttlMs,
          };
          console.info(
            `[GeminiKeyManager] Successfully retrieved dynamic active key from place-service: ${this.cachedKey.maskedKey}`
          );
          return rawKey;
        }
      } else {
        console.warn(
          `[GeminiKeyManager] place-service returned HTTP ${response.status} (${response.statusText}).`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[GeminiKeyManager] Failed to fetch active key from place-service: ${msg}.`);
    }

    throw new Error(
      "No Gemini API key available (both GOOGLE_GENERATIVE_AI_API_KEY and place-service Token Pool are missing)."
    );
  }

  /**
   * Clears cache and reports failure to place-service for auto-rotation.
   */
  public async reportFailure(
    failedKey: string,
    statusCode?: number,
    reason?: string
  ): Promise<string | null> {
    const previousSource = this.cachedKey?.source;
    this.cachedKey = null; // Invalidate cache immediately

    if (previousSource === "env" || (this.getConfiguredEnvKey() && failedKey === this.getConfiguredEnvKey())) {
      return null;
    }

    const isQuota =
      statusCode === 429 ||
      Boolean(
        reason &&
          /quota|exhausted|rate limit|resource has been exhausted|limit:\s*\d+|too many requests/i.test(
            reason
          )
      );

    const isAuth =
      statusCode === 401 ||
      statusCode === 403 ||
      Boolean(
        reason &&
          /api[_\s-]?key[_\s-]?not[_\s-]?valid|invalid[_\s-]?api[_\s-]?key|api key expired|unauthorized|forbidden/i.test(
            reason
          )
      );

    if (!isQuota && !isAuth) {
      return null;
    }

    try {
      const baseUrl = this.baseUrl || config.placeServiceUrl || "http://localhost:8083";
      const url = `${baseUrl}/api/places/internal/keys/rotate`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "GEMINI",
          failedKey,
          status: isQuota ? "EXHAUSTED" : "INVALID",
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
            source: "pool",
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
    if (this.cachedKey?.source === "env" || (this.getConfiguredEnvKey() && rawKey === this.getConfiguredEnvKey())) {
      return;
    }
    const now = Date.now();
    // Throttle to at most once per 10 seconds
    if (now - this.lastReportedSuccessAt < 10_000) {
      return;
    }
    this.lastReportedSuccessAt = now;

    const baseUrl = this.baseUrl || config.placeServiceUrl || "http://localhost:8083";
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
