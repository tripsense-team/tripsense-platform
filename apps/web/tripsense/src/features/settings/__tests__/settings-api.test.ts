import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchPlaceStats,
  updateZioMapKey,
  startBatchEnrichment,
  fetchBatchProgress,
  cancelBatchEnrichment,
  fetchApiKeys,
  addApiKeys,
  deleteApiKey,
  activateApiKey,
  resetQuotaKeys,
} from "../services/settings-api";

describe("Settings API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches place stats successfully", async () => {
    const mockData = {
      totalPlaces: 833,
      enrichedPlaces: 20,
      pendingPlaces: 813,
      zioMapKeyConfigured: true,
      zioMapKeyMasked: "eyJ1c...hub",
      isJobRunning: false,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      }),
    );

    const result = await fetchPlaceStats();
    expect(result.totalPlaces).toBe(833);
    expect(result.zioMapKeyConfigured).toBe(true);
    expect(result.zioMapKeyMasked).toBe("eyJ1c...hub");
  });

  it("updates ZioMap key successfully", async () => {
    const mockRes = {
      valid: true,
      message: "ZioMap API key updated and verified",
      maskedKey: "new_key..._xyz",
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockRes }),
      }),
    );

    const result = await updateZioMapKey("new_key_token_12345");
    expect(result.valid).toBe(true);
    expect(result.maskedKey).toBe("new_key..._xyz");
  });

  it("starts batch enrichment and returns progress", async () => {
    const mockProgress = {
      jobId: "batch-1",
      status: "RUNNING",
      total: 813,
      processed: 0,
      success: 0,
      failed: 0,
      percentage: 0.0,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: 0,
      currentPlaceName: "",
      recentLogs: [],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockProgress }),
      }),
    );

    const result = await startBatchEnrichment({ concurrency: 5, limit: 1000 });
    expect(result.status).toBe("RUNNING");
    expect(result.total).toBe(813);
  });

  it("cancels batch enrichment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: true }),
      }),
    );

    const result = await cancelBatchEnrichment();
    expect(result).toBe(true);
  });

  it("fetches API keys for provider", async () => {
    const mockKeys = [
      {
        id: "key-1",
        provider: "ZIOMAP",
        maskedKey: "abc...xyz",
        status: "ACTIVE",
        successCount: 12,
        createdAt: "2026-09-28T00:00:00Z",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockKeys }),
      }),
    );

    const result = await fetchApiKeys("ZIOMAP");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].maskedKey).toBe("abc...xyz");
  });

  it("adds API keys to pool", async () => {
    const mockKeys = [
      {
        id: "key-2",
        provider: "GEMINI",
        maskedKey: "AIza...999",
        status: "AVAILABLE",
        successCount: 0,
        createdAt: "2026-09-28T00:00:00Z",
      },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockKeys }),
      }),
    );

    const result = await addApiKeys("GEMINI", ["AIzaSyDxyz"]);
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("GEMINI");
  });

  it("deletes API key and activates API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: null }),
      }),
    );

    await expect(deleteApiKey("key-1")).resolves.toBeNull();
    await expect(activateApiKey("key-2")).resolves.toBeNull();
  });

  it("resets quota for provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { resetCount: 3 } }),
      }),
    );

    const result = await resetQuotaKeys("ZIOMAP");
    expect(result.resetCount).toBe(3);
  });
});
