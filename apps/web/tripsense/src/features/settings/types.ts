export interface PlaceStats {
  totalPlaces: number;
  enrichedPlaces: number;
  pendingPlaces: number;
  zioMapKeyConfigured: boolean;
  zioMapKeyMasked: string;
  isJobRunning: boolean;
}

export interface ZioMapKeyUpdateResponse {
  valid: boolean;
  message: string;
  maskedKey: string;
}

export interface BatchEnrichmentRequest {
  concurrency?: number;
  limit?: number;
  forceAll?: boolean;
}

export interface BatchEnrichmentProgress {
  jobId: string;
  status: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  total: number;
  processed: number;
  success: number;
  failed: number;
  percentage: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
  currentPlaceName: string;
  recentLogs: string[];
}

export type ApiKeyProvider = "ZIOMAP" | "GEMINI" | "MAPVINA" | "OPENAI" | "GOOGLE_MAPS";
export type ApiKeyStatus = "ACTIVE" | "INACTIVE" | "AVAILABLE" | "DISABLED" | "EXHAUSTED" | "INVALID";

export interface ApiKeyPoolItem {
  id: string;
  provider: ApiKeyProvider;
  maskedKey: string;
  status: ApiKeyStatus;
  successCount: number;
  failureReason?: string | null;
  lastUsedAt?: string | null;
  exhaustedAt?: string | null;
  createdAt: string;
}
