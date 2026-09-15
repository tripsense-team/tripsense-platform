import * as React from "react";
import { profileService } from "../services/profile-service";
import { UpdateProfileRequest, UserProfile } from "../types";

interface UseUpdateProfileResult {
  mutateAsync: (request: UpdateProfileRequest) => Promise<UserProfile>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateProfile(): UseUpdateProfileResult {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const mutateAsync = React.useCallback(async (request: UpdateProfileRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await profileService.updateProfile(request);
      return response;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to update profile");
      setError(e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutateAsync, isLoading, error };
}
