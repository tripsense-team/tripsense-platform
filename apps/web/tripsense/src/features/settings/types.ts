export interface PlaceStats {
  totalPlaces: number;
  enrichedPlaces: number;
  pendingPlaces: number;
  stalePhotoPlaces?: number;
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
  stalePhotosOnly?: boolean;
  syncEmbedding?: boolean;
}

export interface CloudinaryRelinkSummary {
  configured: boolean;
  dryRun: boolean;
  cloudinaryFoldersFound: number;
  placesScanned: number;
  placesRelinked: number;
  alreadyLinked: number;
  unmatchedCloudinaryFolders: number;
}

export interface MetadataNormalizeSyncSummary {
  dryRun: boolean;
  syncQdrant: boolean;
  placesScanned: number;
  placesUpdated: number;
  cityNormalized: number;
  districtFilled: number;
  primaryTypeDerived: number;
  skippedArchived: number;
  skippedManualOverrides: number;
  qdrantCandidates: number;
  qdrantBatchesSucceeded: number;
  qdrantBatchesFailed: number;
  qdrantSynced: boolean;
  qdrantStatus: string;
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

export type PlaceMediaState =
  | "PENDING"
  | "READY"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "RIGHTS_BLOCKED"
  | "REVIEW_REQUIRED";

export interface PlaceMediaCoverage {
  counts: Record<PlaceMediaState, number>;
  items: Array<{
    placeId: string;
    name: string;
    state: PlaceMediaState;
    reasonCode?: string | null;
  }>;
  nextCursor?: string | null;
}

export interface PlaceMediaBackfillJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  dryRun: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  lastReasonCode?: string | null;
}
