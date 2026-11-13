import { apiClient } from "@/services/api-client";
import type {
  ApiKeyPoolItem,
  ApiKeyProvider,
  BatchEnrichmentProgress,
  BatchEnrichmentRequest,
  CloudinaryRelinkSummary,
  MetadataNormalizeSyncSummary,
  PlaceStats,
  PlaceMediaBackfillJob,
  PlaceMediaCoverage,
  PlaceMediaState,
  ZioMapKeyUpdateResponse,
} from "../types";

export class SettingsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "SettingsApiError";
  }
}

interface ApiResponseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

async function request<T>(
  endpoint: string,
  options: Parameters<typeof apiClient>[1] = {},
): Promise<T> {
  try {
    const envelope = await apiClient<ApiResponseEnvelope<T>>(endpoint, options);
    if (!envelope || envelope.success === false) {
      throw new SettingsApiError(
        envelope?.error?.message || "Request failed",
        400,
        envelope?.error?.code,
      );
    }
    return envelope.data as T;
  } catch (error: any) {
    if (error instanceof SettingsApiError) {
      throw error;
    }
    throw new SettingsApiError(
      error?.message || "Request failed",
      error?.status || 500,
      error?.code,
    );
  }
}

export async function fetchPlaceStats(signal?: AbortSignal): Promise<PlaceStats> {
  return request<PlaceStats>("/api/places/admin/stats", {
    signal,
    cache: "no-store",
  });
}

export async function updateZioMapKey(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ZioMapKeyUpdateResponse> {
  return request<ZioMapKeyUpdateResponse>("/api/places/admin/config/ziomap", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
    signal,
  });
}

export async function startBatchEnrichment(
  req?: BatchEnrichmentRequest,
  signal?: AbortSignal,
): Promise<BatchEnrichmentProgress> {
  return request<BatchEnrichmentProgress>("/api/places/admin/batch-enrich", {
    method: "POST",
    body: JSON.stringify(req || {}),
    signal,
  });
}

export async function fetchBatchProgress(
  signal?: AbortSignal,
): Promise<BatchEnrichmentProgress> {
  return request<BatchEnrichmentProgress>(
    "/api/places/admin/batch-enrich/progress",
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function cancelBatchEnrichment(
  signal?: AbortSignal,
): Promise<boolean> {
  return request<boolean>("/api/places/admin/batch-enrich/cancel", {
    method: "POST",
    signal,
  });
}

export async function relinkCloudinaryPhotos(
  dryRun = false,
  signal?: AbortSignal,
): Promise<CloudinaryRelinkSummary> {
  return request<CloudinaryRelinkSummary>(
    `/api/places/admin/relink-cloudinary-photos?dryRun=${dryRun}`,
    {
      method: "POST",
      signal,
    },
  );
}

export async function normalizeAndSyncQdrant(
  dryRun = false,
  syncQdrant = true,
  asyncSync = true,
  signal?: AbortSignal,
): Promise<MetadataNormalizeSyncSummary> {
  return request<MetadataNormalizeSyncSummary>(
    `/api/places/admin/normalize-and-sync-qdrant?dryRun=${dryRun}&syncQdrant=${syncQdrant}&async=${asyncSync}`,
    {
      method: "POST",
      signal,
    },
  );
}

export async function migrateStalePhotos(
  limit = 2000,
  concurrency = 3,
  signal?: AbortSignal,
): Promise<BatchEnrichmentProgress> {
  return request<BatchEnrichmentProgress>(
    `/api/places/admin/migrate-stale-photos?limit=${limit}&concurrency=${concurrency}`,
    {
      method: "POST",
      signal,
    },
  );
}

export async function fetchApiKeys(
  provider: ApiKeyProvider,
  signal?: AbortSignal,
): Promise<ApiKeyPoolItem[]> {
  return request<ApiKeyPoolItem[]>(
    `/api/places/admin/keys?provider=${provider}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function fetchActiveApiKey(
  provider: ApiKeyProvider,
  signal?: AbortSignal,
): Promise<ApiKeyPoolItem | null> {
  return request<ApiKeyPoolItem | null>(
    `/api/places/admin/keys/active?provider=${provider}`,
    {
      signal,
      cache: "no-store",
    },
  );
}

export async function addApiKeys(
  provider: ApiKeyProvider,
  keys: string[],
  signal?: AbortSignal,
): Promise<ApiKeyPoolItem[]> {
  return request<ApiKeyPoolItem[]>("/api/places/admin/keys", {
    method: "POST",
    body: JSON.stringify({ provider, keys }),
    signal,
  });
}

export async function deleteApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(`/api/places/admin/keys/${id}`, {
    method: "DELETE",
    signal,
  });
}

export async function activateApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(`/api/places/admin/keys/${id}/activate`, {
    method: "POST",
    signal,
  });
}

export async function disableApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(`/api/places/admin/keys/${id}/disable`, {
    method: "POST",
    signal,
  });
}

export async function enableApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  return request<void>(`/api/places/admin/keys/${id}/enable`, {
    method: "POST",
    signal,
  });
}

export async function resetQuotaKeys(
  provider: ApiKeyProvider,
  signal?: AbortSignal,
): Promise<{ resetCount: number }> {
  return request<{ resetCount: number }>(
    `/api/places/admin/keys/reset-quota?provider=${provider}`,
    {
      method: "POST",
      signal,
    },
  );
}

export async function testApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<{
  id: string;
  valid: boolean;
  status: string;
  maskedKey: string;
  failureReason?: string;
}> {
  return request<{
    id: string;
    valid: boolean;
    status: string;
    maskedKey: string;
    failureReason?: string;
  }>(`/api/places/admin/keys/${id}/test`, {
    method: "POST",
    signal,
  });
}

export async function fetchPlaceMediaCoverage(
  state?: PlaceMediaState,
  signal?: AbortSignal,
): Promise<PlaceMediaCoverage> {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return request<PlaceMediaCoverage>(`/api/places/admin/media/coverage${query}`, {
    cache: "no-store",
    signal,
  });
}

export async function startPlaceMediaBackfill(
  dryRun: boolean,
  signal?: AbortSignal,
): Promise<PlaceMediaBackfillJob> {
  return request<PlaceMediaBackfillJob>("/api/places/admin/media/backfill-jobs", {
    method: "POST",
    body: JSON.stringify({
      states: ["PENDING", "DEGRADED", "UNAVAILABLE"],
      limit: 500,
      dryRun,
      maxConcurrency: 3,
      idempotencyKey: `place-media-${dryRun ? "audit" : "backfill"}-${crypto.randomUUID()}`,
    }),
    signal,
  });
}

export async function fetchPlaceMediaBackfill(
  jobId: string,
  signal?: AbortSignal,
): Promise<PlaceMediaBackfillJob> {
  return request<PlaceMediaBackfillJob>(
    `/api/places/admin/media/backfill-jobs/${encodeURIComponent(jobId)}`,
    { cache: "no-store", signal },
  );
}
