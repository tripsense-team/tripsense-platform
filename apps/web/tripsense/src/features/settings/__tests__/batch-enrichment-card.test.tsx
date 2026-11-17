import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { BatchEnrichmentCard } from "../components/batch-enrichment-card";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const {
  mockFetchBatchProgress,
  mockStartBatchEnrichment,
  mockCancelBatchEnrichment,
  mockRelinkCloudinaryPhotos,
  mockNormalizeAndSyncQdrant,
  mockMigrateStalePhotos,
} = vi.hoisted(() => ({
  mockFetchBatchProgress: vi.fn(),
  mockStartBatchEnrichment: vi.fn(),
  mockCancelBatchEnrichment: vi.fn(),
  mockRelinkCloudinaryPhotos: vi.fn(),
  mockNormalizeAndSyncQdrant: vi.fn(),
  mockMigrateStalePhotos: vi.fn(),
}));

vi.mock("../services/settings-api", () => ({
  fetchBatchProgress: mockFetchBatchProgress,
  startBatchEnrichment: mockStartBatchEnrichment,
  cancelBatchEnrichment: mockCancelBatchEnrichment,
  relinkCloudinaryPhotos: mockRelinkCloudinaryPhotos,
  normalizeAndSyncQdrant: mockNormalizeAndSyncQdrant,
  migrateStalePhotos: mockMigrateStalePhotos,
}));

function renderCard(onJobFinished = vi.fn()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <I18nProvider>
        <BatchEnrichmentCard onJobFinished={onJobFinished} />
      </I18nProvider>,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function clickButtonContaining(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes(text),
  );
  if (!button) {
    throw new Error(`Button containing "${text}" not found`);
  }
  act(() => {
    button.click();
  });
}

describe("BatchEnrichmentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBatchProgress.mockResolvedValue({
      jobId: "",
      status: "IDLE",
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      percentage: 0,
      elapsedSeconds: 0,
      estimatedRemainingSeconds: 0,
      currentPlaceName: "",
      recentLogs: [],
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("forwards limit=2000 and syncEmbedding when starting batch enrichment", async () => {
    mockStartBatchEnrichment.mockResolvedValueOnce({
      jobId: "batch-1",
      status: "COMPLETED",
      total: 10,
      processed: 10,
      success: 10,
      failed: 0,
      percentage: 100,
      elapsedSeconds: 1,
      estimatedRemainingSeconds: 0,
      currentPlaceName: "",
      recentLogs: [],
    });

    const onJobFinished = vi.fn();
    const { container, unmount } = renderCard(onJobFinished);

    await act(async () => {
      clickButtonContaining(container, "Bắt đầu làm giàu dữ liệu");
    });

    expect(mockStartBatchEnrichment).toHaveBeenCalledWith({
      concurrency: 5,
      limit: 2000,
      forceAll: false,
      syncEmbedding: true,
    });
    unmount();
  });

  it("executes relink Cloudinary, normalize & Qdrant sync, and sanitized error handling", async () => {
    mockRelinkCloudinaryPhotos.mockResolvedValueOnce({
      configured: true,
      dryRun: false,
      cloudinaryFoldersFound: 100,
      placesScanned: 1556,
      placesRelinked: 61,
      alreadyLinked: 35,
      unmatchedCloudinaryFolders: 4,
    });
    mockNormalizeAndSyncQdrant.mockResolvedValueOnce({
      dryRun: false,
      syncQdrant: true,
      placesScanned: 1556,
      placesUpdated: 1390,
      cityNormalized: 67,
      districtFilled: 210,
      primaryTypeDerived: 1300,
      skippedArchived: 0,
      skippedManualOverrides: 0,
      qdrantCandidates: 1556,
      qdrantBatchesSucceeded: 32,
      qdrantBatchesFailed: 0,
      qdrantSynced: true,
      qdrantStatus: "SYNCED",
    });

    const onJobFinished = vi.fn();
    const { container, unmount } = renderCard(onJobFinished);

    await act(async () => {
      clickButtonContaining(container, "Khôi phục ảnh Cloudinary");
    });
    expect(mockRelinkCloudinaryPhotos).toHaveBeenCalledWith(false);
    expect(container.textContent).toContain("61");
    expect(onJobFinished).toHaveBeenCalled();

    await act(async () => {
      clickButtonContaining(container, "Chuẩn hóa Metadata & Đồng bộ Qdrant");
    });
    expect(mockNormalizeAndSyncQdrant).toHaveBeenCalledWith(false, true, true);
    expect(container.textContent).toContain("1390");

    mockMigrateStalePhotos.mockRejectedValueOnce(new Error("SENSITIVE_JDBC_STACKTRACE"));
    await act(async () => {
      clickButtonContaining(container, "Làm giàu ảnh thiếu");
    });
    expect(mockMigrateStalePhotos).toHaveBeenCalledWith(2000, 5);
    expect(container.textContent).not.toContain("SENSITIVE_JDBC_STACKTRACE");
    expect(container.textContent).toContain("Không thể thực hiện tác vụ bảo trì");
    unmount();
  });

  it("polls live progress when normalize starts async Qdrant sync or a job is already running", async () => {
    mockNormalizeAndSyncQdrant
      .mockResolvedValueOnce({
        dryRun: false,
        syncQdrant: true,
        placesScanned: 1556,
        placesUpdated: 0,
        cityNormalized: 0,
        districtFilled: 0,
        primaryTypeDerived: 0,
        skippedArchived: 0,
        skippedManualOverrides: 0,
        qdrantCandidates: 1556,
        qdrantBatchesSucceeded: 0,
        qdrantBatchesFailed: 0,
        qdrantSynced: false,
        qdrantStatus: "SYNC_STARTED",
      })
      .mockResolvedValueOnce({
        dryRun: false,
        syncQdrant: true,
        placesScanned: 1556,
        placesUpdated: 0,
        cityNormalized: 0,
        districtFilled: 0,
        primaryTypeDerived: 0,
        skippedArchived: 0,
        skippedManualOverrides: 0,
        qdrantCandidates: 1556,
        qdrantBatchesSucceeded: 0,
        qdrantBatchesFailed: 0,
        qdrantSynced: false,
        qdrantStatus: "JOB_ALREADY_RUNNING",
      });

    const { container, unmount } = renderCard();

    await act(async () => {
      clickButtonContaining(container, "Chuẩn hóa Metadata & Đồng bộ Qdrant");
    });
    expect(container.textContent).toContain("Đang đồng bộ 1556 địa điểm sang Qdrant ở nền");
    expect(mockFetchBatchProgress).toHaveBeenCalledTimes(2);

    await act(async () => {
      clickButtonContaining(container, "Chuẩn hóa Metadata & Đồng bộ Qdrant");
    });
    expect(container.textContent).toContain("Đang có một tiến trình nền chạy sẵn");
    expect(mockFetchBatchProgress).toHaveBeenCalledTimes(3);

    unmount();
  });
});

