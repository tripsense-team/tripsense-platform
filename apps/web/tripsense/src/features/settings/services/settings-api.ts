import { apiClient } from "@/services/api-client";
import type {
  ApiKeyPoolItem,
  BatchEnrichmentProgress,
  BatchEnrichmentRequest,
  PlaceStats,
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

export async function fetchApiKeys(
  provider: "ZIOMAP" | "GEMINI",
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

export async function addApiKeys(
  provider: "ZIOMAP" | "GEMINI",
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

export async function resetQuotaKeys(
  provider: "ZIOMAP" | "GEMINI",
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
