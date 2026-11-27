import { apiClient } from "@/services/api-client";
import type { OnboardingProfile, UpdateOnboardingRequest } from "../types";

let inFlightStart: Promise<OnboardingProfile> | null = null;

export const onboardingApi = {
  get: () => apiClient<OnboardingProfile>("/api/context/onboarding", { cache: "no-store" }),
  start: () => {
    if (!inFlightStart) {
      inFlightStart = apiClient<OnboardingProfile>("/api/context/onboarding/start", {
        method: "POST",
      }).finally(() => {
        inFlightStart = null;
      });
    }
    return inFlightStart;
  },
  save: (payload: UpdateOnboardingRequest) =>
    apiClient<OnboardingProfile>("/api/context/onboarding", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  complete: (version: number) =>
    apiClient<OnboardingProfile>("/api/context/onboarding/complete", {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  markProfileComplete: () =>
    apiClient<void>("/api/users/profile/onboarding-complete", {
      method: "POST",
    }),
  getGate: () =>
    apiClient<{ required: boolean }>("/api/users/me/onboarding-gate"),
};
