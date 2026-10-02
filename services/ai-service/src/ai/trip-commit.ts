import crypto from "node:crypto";
import { config } from "../config.js";

export type TripCommitItem = {
  sourceItemKey: string;
  dayNumber: number;
  title: string;
  itemType: "PLACE" | "MEAL" | "HOTEL" | "ACTIVITY";
  placeRef: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
};

export type TripDraft = {
  name: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  travelerCount: number;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  notes: string | null;
};

export type TripCommitRequest = {
  action: "CREATE_TRIP" | "ADD_TO_TRIP";
  targetTripId: string | null;
  proposalId: string;
  proposalHash: string;
  expectedTripRevision: number | null;
  tripDraft: TripDraft | null;
  items: TripCommitItem[];
};

export type TripCommitResult = {
  operationId: string;
  status: string;
  action: "CREATE_TRIP" | "ADD_TO_TRIP";
  tripId: string;
  tripName: string;
  tripRevision: number;
  appliedCount: number;
  skippedCount: number;
  items: Array<{ itemKey: string; itineraryItemId: string; status: string }>;
  replayed: boolean;
};

export class TripCommitError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
  }
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function deterministicCommitKey(...parts: string[]): string {
  return sha256(parts.join(":"));
}

export async function commitTripMutation(input: {
  authorization: string;
  userId: string;
  idempotencyKey: string;
  request: TripCommitRequest;
}): Promise<TripCommitResult> {
  if (!config.aiTripCommitSecret) {
    throw new TripCommitError("TRIP_COMMIT_UNAVAILABLE", 503);
  }

  const rawBody = JSON.stringify(input.request);
  const bodyHash = sha256(rawBody);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", config.aiTripCommitSecret)
    .update(`${timestamp}\n${input.userId}\n${input.idempotencyKey}\n${bodyHash}`)
    .digest("hex");

  let response: Response;
  try {
    response = await fetch(`${config.tripServiceUrl}/internal/ai/itinerary-commits`, {
      method: "POST",
      headers: {
        Authorization: input.authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
        "X-AI-Commit-Timestamp": timestamp,
        "X-AI-Commit-Body-Sha256": bodyHash,
        "X-AI-Commit-Signature": signature,
      },
      body: rawBody,
    });
  } catch {
    throw new TripCommitError("TRIP_COMMIT_UNAVAILABLE", 502);
  }

  if (!response.ok) {
    if (response.status === 409) {
      throw new TripCommitError("TRIP_VERSION_CONFLICT", 409);
    }
    if (response.status === 403) {
      throw new TripCommitError("TRIP_ACCESS_DENIED", 403);
    }
    throw new TripCommitError("TRIP_COMMIT_FAILED", 502);
  }

  const payload = (await response.json()) as { data?: TripCommitResult };
  if (!payload.data?.tripId) {
    throw new TripCommitError("TRIP_COMMIT_FAILED", 502);
  }
  return payload.data;
}
