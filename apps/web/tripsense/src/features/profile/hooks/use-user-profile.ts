import * as React from "react";
import { profileService } from "../services/profile-service";
import { UserProfile } from "../types";

export function useUserProfile(userId?: string) {
  const [data, setData] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let ignore = false;

    async function load() {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await profileService.getUserProfile(userId);
        if (!ignore) {
          setData(response);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch user profile"),
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [userId]);

  const refetch = React.useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await profileService.getUserProfile(userId);
      setData(response);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch user profile"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
