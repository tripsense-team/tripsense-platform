import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: vi.fn(),
}));

vi.mock("@/services/api-client", () => ({
  apiClient: mockApiClient,
}));

import {
  fetchPlaceStats,
  updateZioMapKey,
  startBatchEnrichment,
  fetchBatchProgress,
  cancelBatchEnrichment,
  fetchApiKeys,
  fetchActiveApiKey,
  addApiKeys,
  deleteApiKey,
  activateApiKey,
  disableApiKey,
  enableApiKey,
  resetQuotaKeys,
  testApiKey,
} from "../services/settings-api";

describe("Settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches place stats successfully via admin endpoint", async () => {
    const mockData = {
      totalPlaces: 833,
      enrichedPlaces: 20,
      pendingPlaces: 813,
      zioMapKeyConfigured: true,
      zioMapKeyMasked: "eyJ1c...hub",
      isJobRunning: false,
    };

    mockApiClient.mockResolvedValueOnce({ success: true, data: mockData });

    const result = await fetchPlaceStats();
    expect(result.totalPlaces).toBe(833);
    expect(result.zioMapKeyConfigured).toBe(true);
    expect(result.zioMapKeyMasked).toBe("eyJ1c...hub");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/stats",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("updates ZioMap key successfully via admin endpoint", async () => {
    const mockRes = {
      valid: true,
      message: "ZioMap API key updated and verified",
      maskedKey: "new_key..._xyz",
    };

    mockApiClient.mockResolvedValueOnce({ success: true, data: mockRes });

    const result = await updateZioMapKey("new_key_token_12345");
    expect(result.valid).toBe(true);
    expect(result.maskedKey).toBe("new_key..._xyz");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/config/ziomap",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ apiKey: "new_key_token_12345" }),
      }),
    );
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

    mockApiClient.mockResolvedValueOnce({ success: true, data: mockProgress });

    const result = await startBatchEnrichment({ concurrency: 5, limit: 1000 });
    expect(result.status).toBe("RUNNING");
    expect(result.total).toBe(813);
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/batch-enrich",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ concurrency: 5, limit: 1000 }),
      }),
    );
  });

  it("cancels batch enrichment", async () => {
    mockApiClient.mockResolvedValueOnce({ success: true, data: true });

    const result = await cancelBatchEnrichment();
    expect(result).toBe(true);
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/batch-enrich/cancel",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fetches API keys for provider via admin endpoint", async () => {
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

    mockApiClient.mockResolvedValueOnce({ success: true, data: mockKeys });

    const result = await fetchApiKeys("ZIOMAP");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("ACTIVE");
    expect(result[0].maskedKey).toBe("abc...xyz");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys?provider=ZIOMAP",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("adds API keys to pool via admin endpoint", async () => {
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

    mockApiClient.mockResolvedValueOnce({ success: true, data: mockKeys });

    const result = await addApiKeys("GEMINI", ["AIzaSyDxyz"]);
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("GEMINI");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ provider: "GEMINI", keys: ["AIzaSyDxyz"] }),
      }),
    );
  });

  it("deletes API key and activates API key via admin endpoint", async () => {
    mockApiClient.mockResolvedValueOnce({ success: true, data: null });
    await expect(deleteApiKey("key-1")).resolves.toBeNull();
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/key-1",
      expect.objectContaining({ method: "DELETE" }),
    );

    mockApiClient.mockResolvedValueOnce({ success: true, data: null });
    await expect(activateApiKey("key-2")).resolves.toBeNull();
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/key-2/activate",
      expect.objectContaining({ method: "POST" }),
    );

    mockApiClient.mockResolvedValueOnce({ success: true, data: null });
    await expect(disableApiKey("key-2")).resolves.toBeNull();
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/key-2/disable",
      expect.objectContaining({ method: "POST" }),
    );

    mockApiClient.mockResolvedValueOnce({ success: true, data: null });
    await expect(enableApiKey("key-2")).resolves.toBeNull();
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/key-2/enable",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fetches active API key for provider", async () => {
    const mockActive = {
      id: "key-1",
      provider: "ZIOMAP",
      maskedKey: "abc...xyz",
      status: "ACTIVE",
    };
    mockApiClient.mockResolvedValueOnce({ success: true, data: mockActive });
    const result = await fetchActiveApiKey("ZIOMAP");
    expect(result?.status).toBe("ACTIVE");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/active?provider=ZIOMAP",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("resets quota for provider via admin endpoint", async () => {
    mockApiClient.mockResolvedValueOnce({
      success: true,
      data: { resetCount: 3 },
    });

    const result = await resetQuotaKeys("ZIOMAP");
    expect(result.resetCount).toBe(3);
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/reset-quota?provider=ZIOMAP",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("tests API key via admin endpoint", async () => {
    mockApiClient.mockResolvedValueOnce({
      success: true,
      data: { id: "key-1", valid: true, status: "ACTIVE" },
    });

    const result = await testApiKey("key-1");
    expect(result.valid).toBe(true);
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/places/admin/keys/key-1/test",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
