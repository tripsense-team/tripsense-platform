import { create } from "zustand";
import type { Place } from "../types";
import {
  DESTINATION_PRESETS,
  type DestinationPreset,
} from "../components/explore-feed-header";

export interface ExploreState {
  currentDestination: DestinationPreset;
  activeCategoryId: string;
  query: string;
  committedQuery: string;
  places: Place[];
  selectedPlaceId: string | null;
  detailPlace: Place | null;
  isDetailOpen: boolean;
  isLoading: boolean;
  isLoadingDetails: boolean;
  showExploreAreaBtn: boolean;
  isPanelCollapsed: boolean;
  mobileTab: "list" | "map";
  hasInitialFetched: boolean;
  recommendationId: string | null;
  recommendationRanks: Record<string, number>;
  recommendationFallbackLevel: string | null;
  recommendationIsStale: boolean;
  loadedUserId: string | null;

  // Category cache: key format `${destId}:${catId}:${trimmedQuery}`
  categoryCache: Record<string, Place[]>;

  // Actions
  setCurrentDestination: (dest: DestinationPreset) => void;
  setActiveCategoryId: (catId: string) => void;
  setQuery: (query: string) => void;
  setCommittedQuery: (query: string) => void;
  setPlaces: (places: Place[] | ((prev: Place[]) => Place[])) => void;
  setSelectedPlaceId: (
    id: string | null | ((prev: string | null) => string | null)
  ) => void;
  setDetailPlace: (
    place: Place | null | ((prev: Place | null) => Place | null)
  ) => void;
  setIsDetailOpen: (open: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsLoadingDetails: (loading: boolean) => void;
  setShowExploreAreaBtn: (show: boolean) => void;
  setIsPanelCollapsed: (
    collapsed: boolean | ((prev: boolean) => boolean)
  ) => void;
  setMobileTab: (tab: "list" | "map") => void;
  setHasInitialFetched: (fetched: boolean) => void;
  setRecommendationMeta: (value: {
    recommendationId: string;
    ranks: Record<string, number>;
    fallbackLevel: string;
    stale: boolean;
  } | null) => void;
  setLoadedUserId: (userId: string | null) => void;
  cacheCategoryResult: (key: string, data: Place[]) => void;
  getCachedCategoryResult: (key: string) => Place[] | undefined;
  resetExploreState: (nextUserId?: string | null) => void;
}

export const useExploreStore = create<ExploreState>((set, get) => ({
  currentDestination: DESTINATION_PRESETS[0],
  activeCategoryId: "for-you",
  query: "",
  committedQuery: "",
  places: [],
  selectedPlaceId: null,
  detailPlace: null,
  isDetailOpen: false,
  isLoading: true,
  isLoadingDetails: false,
  showExploreAreaBtn: false,
  isPanelCollapsed: false,
  mobileTab: "list",
  hasInitialFetched: false,
  recommendationId: null,
  recommendationRanks: {},
  recommendationFallbackLevel: null,
  recommendationIsStale: false,
  loadedUserId: null,
  categoryCache: {},

  setCurrentDestination: (dest) =>
    set({
      currentDestination: dest,
      query: "",
      committedQuery: "",
      activeCategoryId: "for-you",
      selectedPlaceId: null,
      showExploreAreaBtn: false,
    }),

  setActiveCategoryId: (catId) => set({ activeCategoryId: catId }),

  setQuery: (query) => set({ query }),

  setCommittedQuery: (committedQuery) => set({ committedQuery }),

  setPlaces: (updater) =>
    set((state) => ({
      places: typeof updater === "function" ? updater(state.places) : updater,
    })),

  setSelectedPlaceId: (updater) =>
    set((state) => ({
      selectedPlaceId:
        typeof updater === "function"
          ? updater(state.selectedPlaceId)
          : updater,
    })),

  setDetailPlace: (updater) =>
    set((state) => ({
      detailPlace:
        typeof updater === "function" ? updater(state.detailPlace) : updater,
    })),

  setIsDetailOpen: (isDetailOpen) => set({ isDetailOpen }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsLoadingDetails: (isLoadingDetails) => set({ isLoadingDetails }),

  setShowExploreAreaBtn: (showExploreAreaBtn) => set({ showExploreAreaBtn }),

  setIsPanelCollapsed: (updater) =>
    set((state) => ({
      isPanelCollapsed:
        typeof updater === "function"
          ? updater(state.isPanelCollapsed)
          : updater,
    })),

  setMobileTab: (mobileTab) => set({ mobileTab }),

  setHasInitialFetched: (hasInitialFetched) => set({ hasInitialFetched }),

  setRecommendationMeta: (value) =>
    set(
      value
        ? {
            recommendationId: value.recommendationId,
            recommendationRanks: value.ranks,
            recommendationFallbackLevel: value.fallbackLevel,
            recommendationIsStale: value.stale,
          }
        : {
            recommendationId: null,
            recommendationRanks: {},
            recommendationFallbackLevel: null,
            recommendationIsStale: false,
          },
    ),

  setLoadedUserId: (loadedUserId) => set({ loadedUserId }),

  cacheCategoryResult: (key, data) =>
    set((state) => ({
      categoryCache: {
        ...state.categoryCache,
        [key]: data,
      },
    })),

  getCachedCategoryResult: (key) => get().categoryCache[key],

  resetExploreState: (nextUserId?: string | null) =>
    set({
      currentDestination: DESTINATION_PRESETS[0],
      activeCategoryId: "for-you",
      query: "",
      committedQuery: "",
      places: [],
      selectedPlaceId: null,
      detailPlace: null,
      isDetailOpen: false,
      isLoading: true,
      isLoadingDetails: false,
      showExploreAreaBtn: false,
      isPanelCollapsed: false,
      mobileTab: "list",
      hasInitialFetched: false,
      recommendationId: null,
      recommendationRanks: {},
      recommendationFallbackLevel: null,
      recommendationIsStale: false,
      loadedUserId: nextUserId !== undefined ? nextUserId : null,
      categoryCache: {},
    }),
}));
