import type {
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

async function handleResponse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as ApiResponseEnvelope<T> | null;
  if (!res.ok || json?.success === false) {
    throw new SettingsApiError(
      json?.error?.message || `Request failed with status ${res.status}`,
      res.status,
      json?.error?.code,
    );
  }
  return json?.data as T;
}

export async function fetchPlaceStats(signal?: AbortSignal): Promise<PlaceStats> {
  const res = await fetch("/api/places/internal/stats", {
    signal,
    cache: "no-store",
  });
  return handleResponse<PlaceStats>(res);
}

export async function updateZioMapKey(
  apiKey: string,
  signal?: AbortSignal,
): Promise<ZioMapKeyUpdateResponse> {
  const res = await fetch("/api/places/internal/config/ziomap", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
    signal,
  });
  return handleResponse<ZioMapKeyUpdateResponse>(res);
}

export async function startBatchEnrichment(
  req?: BatchEnrichmentRequest,
  signal?: AbortSignal,
): Promise<BatchEnrichmentProgress> {
  const res = await fetch("/api/places/internal/batch-enrich", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req || {}),
    signal,
  });
  return handleResponse<BatchEnrichmentProgress>(res);
}

export async function fetchBatchProgress(
  signal?: AbortSignal,
): Promise<BatchEnrichmentProgress> {
  const res = await fetch("/api/places/internal/batch-enrich/progress", {
    signal,
    cache: "no-store",
  });
  return handleResponse<BatchEnrichmentProgress>(res);
}

export async function cancelBatchEnrichment(
  signal?: AbortSignal,
): Promise<boolean> {
  const res = await fetch("/api/places/internal/batch-enrich/cancel", {
    method: "POST",
    signal,
  });
  return handleResponse<boolean>(res);
}

export async function fetchApiKeys(
  provider: "ZIOMAP" | "GEMINI",
  signal?: AbortSignal,
): Promise<import("../types").ApiKeyPoolItem[]> {
  const res = await fetch(`/api/places/internal/keys?provider=${provider}`, {
    signal,
    cache: "no-store",
  });
  return handleResponse<import("../types").ApiKeyPoolItem[]>(res);
}

export async function addApiKeys(
  provider: "ZIOMAP" | "GEMINI",
  keys: string[],
  signal?: AbortSignal,
): Promise<import("../types").ApiKeyPoolItem[]> {
  const res = await fetch("/api/places/internal/keys", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider, keys }),
    signal,
  });
  return handleResponse<import("../types").ApiKeyPoolItem[]>(res);
}

export async function deleteApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/places/internal/keys/${id}`, {
    method: "DELETE",
    signal,
  });
  return handleResponse<void>(res);
}

export async function activateApiKey(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`/api/places/internal/keys/${id}/activate`, {
    method: "POST",
    signal,
  });
  return handleResponse<void>(res);
}

export async function resetQuotaKeys(
  provider: "ZIOMAP" | "GEMINI",
  signal?: AbortSignal,
): Promise<{ resetCount: number }> {
  const res = await fetch(`/api/places/internal/keys/reset-quota?provider=${provider}`, {
    method: "POST",
    signal,
  });
  return handleResponse<{ resetCount: number }>(res);
}
