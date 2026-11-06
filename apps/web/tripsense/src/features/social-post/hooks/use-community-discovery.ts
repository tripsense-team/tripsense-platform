import * as React from "react";
import { socialPostRepository } from "../services";
import type {
  SuggestedCreator,
  DestinationWeather,
  TrendingDestination,
} from "../types";

export function useCommunityDiscovery() {
  const [creators, setCreators] = React.useState<SuggestedCreator[]>([]);
  const [weather, setWeather] = React.useState<DestinationWeather | null>(null);
  const [trendingDestinations, setTrendingDestinations] = React.useState<
    TrendingDestination[]
  >([]);
  const [selectedCity, setSelectedCity] = React.useState<string>("dalat");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [weatherLoading, setWeatherLoading] = React.useState<boolean>(false);
  const weatherReqIdRef = React.useRef(0);
  const pendingFollowRef = React.useRef<Set<string>>(new Set());
  const [followingMap, setFollowingMap] = React.useState<
    Record<string, boolean>
  >({});

  // Initial load
  React.useEffect(() => {
    let ignore = false;
    async function loadDiscoveryData() {
      setLoading(true);
      try {
        const [creatorsResult, weatherResult, trendingResult] = await Promise.allSettled([
          socialPostRepository.getSuggestedCreators(),
          socialPostRepository.getDestinationWeather(selectedCity),
          socialPostRepository.getTrendingDestinations(),
        ]);

        if (!ignore) {
          setCreators(creatorsResult.status === "fulfilled" ? creatorsResult.value : []);
          setWeather(weatherResult.status === "fulfilled" ? weatherResult.value : null);
          setTrendingDestinations(
            trendingResult.status === "fulfilled" ? trendingResult.value : [],
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadDiscoveryData();
    return () => {
      ignore = true;
    };
  }, []);

  // Update weather when selectedCity changes with race-condition check
  const changeCity = React.useCallback(async (cityId: string) => {
    setSelectedCity(cityId);
    setWeatherLoading(true);
    const reqId = ++weatherReqIdRef.current;
    try {
      const data = await socialPostRepository.getDestinationWeather(cityId);
      if (reqId === weatherReqIdRef.current) {
        setWeather(data);
      }
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("[useCommunityDiscovery] Failed to update weather");
      }
    } finally {
      if (reqId === weatherReqIdRef.current) {
        setWeatherLoading(false);
      }
    }
  }, []);

  // Optimistic Follow / Unfollow with lock
  const toggleFollow = React.useCallback(
    async (creatorId: string) => {
      if (pendingFollowRef.current.has(creatorId)) return;
      const target = creators.find((c) => c.id === creatorId);
      if (!target) return;

      pendingFollowRef.current.add(creatorId);
      const currentFollowing = target.isFollowing;
      const nextFollowing = !currentFollowing;
      const nextCount = Math.max(
        0,
        target.followerCount + (nextFollowing ? 1 : -1),
      );

      // Optimistic update
      setCreators((prev) =>
        prev.map((c) =>
          c.id === creatorId
            ? { ...c, isFollowing: nextFollowing, followerCount: nextCount }
            : c,
        ),
      );
      setFollowingMap((prev) => ({ ...prev, [creatorId]: true }));

      try {
        const result = await socialPostRepository.toggleFollowCreator(
          creatorId,
          currentFollowing,
        );
        setCreators((prev) =>
          prev.map((c) =>
            c.id === creatorId
              ? {
                  ...c,
                  isFollowing: result.following,
                  followerCount: result.followerCount,
                }
              : c,
          ),
        );
      } catch {
        // Rollback on error
        setCreators((prev) =>
          prev.map((c) =>
            c.id === creatorId
              ? {
                  ...c,
                  isFollowing: currentFollowing,
                  followerCount: target.followerCount,
                }
              : c,
          ),
        );
        if (process.env.NODE_ENV === "development") {
          console.warn("[useCommunityDiscovery] Follow toggle failed and rolled back");
        }
      } finally {
        pendingFollowRef.current.delete(creatorId);
        setFollowingMap((prev) => {
          const next = { ...prev };
          delete next[creatorId];
          return next;
        });
      }
    },
    [creators],
  );

  return {
    creators,
    weather,
    trendingDestinations,
    selectedCity,
    loading,
    weatherLoading,
    followingMap,
    changeCity,
    toggleFollow,
  };
}
