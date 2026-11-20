"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useArtifact } from "@/hooks/use-artifact";
import { useAuthStore, AuthModal } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { ChatHeader } from "./chat-header";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { TripDetailPanel } from "./trip-detail-panel";
import { ChatZioMapPanel } from "./chat-ziomap-panel";
import { extractAiChatMapData } from "./chat-map-places";
import {
  buildChatPlaceLookup,
  extractPlaceMentionTargets,
  isRealCatalogPlaceId,
  resolveAndHydrateChatPlace,
  toCanonicalDetailPlace,
  type OpenPlaceDetailTarget,
} from "./chat-place-resolver";
import { useAiDrawerStore } from "@/stores/use-ai-drawer-store";
import {
  WhereModal,
  WhenModal,
  WhoModal,
  BudgetModal,
  CreateTripModal,
  type ActiveModalType,
  type TripPreferences,
} from "./modals";
import {
  createTrip,
  getItinerary,
  getTrip,
  updateTrip,
} from "@/features/trip-management/services/trip-management-api";
import {
  resolveFlexibleDates,
  isoDateFromToday,
  parseFlexiblePreferenceFromNotes,
} from "@/features/trip-management/utils/date";
import { inferDestinationFromPrompt } from "@/features/trip-management/utils/map";
import type {
  ItineraryResponse,
  TripResponse,
} from "@/features/trip-management/types";
import { getPlaceBatchSnapshots } from "@/features/places/services/places-api";
import { PlaceDetailOverlay } from "@/features/places/components/place-detail-overlay";
import type { Place } from "@/features/places/types";
import {
  AddToTripDialog,
  SaveToCollectionDialog,
  usePlaceActions,
} from "@/features/place-actions";
import {
  getChatTripContext,
  getPlanningBrief,
  linkChatToTrip,
  patchPlanningBrief,
} from "@/features/ai-trip-commit/services/ai-trip-commit-api";
import type { TripPlanningBrief } from "@/features/ai-trip-commit/types";
import { isGenericChatTitle } from "@/hooks/use-ai-chats";
import { aiChatQueryKeys, getQueryClient } from "@/lib/react-query";
import { cn } from "@/lib/utils";

const EMPTY_DAY_THEMES: Record<number, string> = {};
const EMPTY_PLACE_PHOTOS: Record<string, string> = {};
const DRAWER_SLIDE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ITINERARY_MUTATING_TOOLS = new Set([
  "createTripProposal",
  "addItineraryItems",
  "removeItineraryItem",
  "replaceItineraryItem",
  "updateItineraryItem",
  "reorderItineraryItems",
]);

function extractThemesFromText(text: string, map: Record<number, string>) {
  const matches = text.matchAll(/(?:Ngày|Day)\s*(\d+)\s*[:–-]\s*([^\n\r#*]+)/gi);
  for (const match of matches) {
    const dayNum = parseInt(match[1], 10);
    const theme = match[2].trim().replace(/^[*_~]+|[*_~]+$/g, "");
    if (dayNum && theme && !map[dayNum]) {
      map[dayNum] = theme;
    }
  }
}

export function ChatShell() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const searchParams = useSearchParams();
  const tripIdParam = searchParams?.get("tripId");
  const prefersReducedMotion = useReducedMotion();
  const drawerSlideTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.28, ease: DRAWER_SLIDE_EASE },
    [prefersReducedMotion],
  );

  const {
    chatId,
    chatTitle,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    input,
    setInput,
    currentModelId,
    setCurrentModelId,
    chatList,
    startNewChat,
    deleteChat,
    renameChat,
    syncTripContext,
    isBackendReady,
    isHistoryLoading,
  } = useActiveChat();

  const toggleDrawer = useAiDrawerStore((state) => state.toggleDrawer);
  const { artifact } = useArtifact();

  // Modals state
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active Trip & Unified Right Side Panel state ("closed" | "map" | "trip-detail")
  const [activeTrip, setActiveTrip] = useState<TripResponse | null>(null);
  const [rightPanelMode, setRightPanelMode] = useState<"closed" | "map" | "trip-detail">("closed");
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [activeItinerary, setActiveItinerary] = useState<ItineraryResponse | null>(null);
  const [placeSnapshots, setPlaceSnapshots] = useState<Record<string, Place>>({});
  const [selectedMapDayNumber, setSelectedMapDayNumber] = useState<number | null>(null);
  const [selectedMapPlaceId, setSelectedMapPlaceId] = useState<string | null>(null);
  const [mapFitBoundsTrigger, setMapFitBoundsTrigger] = useState(0);

  // Place Detail slide drawer & saved actions state (scoped per chatId to avoid effect setState)
  const [placeDetailState, setPlaceDetailState] = useState<{
    chatId: string;
    place: Place;
    isLoading: boolean;
    isExpanded: boolean;
  } | null>(null);
  const [saveDialogState, setSaveDialogState] = useState<{
    chatId: string;
    place: Place;
  } | null>(null);
  const [tripDialogState, setTripDialogState] = useState<{
    chatId: string;
    place: Place;
  } | null>(null);
  const placeDetailsCacheRef = useRef<Map<string, Place>>(new Map());
  const photoCheckedAtCacheRef = useRef<Map<string, number>>(new Map());
  const detailAbortControllerRef = useRef<AbortController | null>(null);
  const detailRequestSeqRef = useRef(0);

  const scopedPlaceDetail =
    placeDetailState?.chatId === chatId ? placeDetailState : null;
  const activeDetailPlace = scopedPlaceDetail?.place ?? null;
  const isLoadingPlaceDetail = scopedPlaceDetail?.isLoading ?? false;
  const isPlaceDetailExpanded = scopedPlaceDetail?.isExpanded ?? false;
  const saveDialogPlace =
    saveDialogState?.chatId === chatId ? saveDialogState.place : null;
  const tripDialogPlace =
    tripDialogState?.chatId === chatId ? tripDialogState.place : null;

  const isTripDetailOpen = rightPanelMode === "trip-detail";
  const isMapPanelOpen = rightPanelMode === "map";
  const dismissedMapChatIdsRef = useRef<Set<string>>(new Set());
  const attemptedSnapshotIdsRef = useRef<Set<string>>(new Set());

  const openDesktopMapIfAllowed = useCallback(
    (force = false) => {
      if (typeof window === "undefined") return;
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      if (!force && (!isDesktop || dismissedMapChatIdsRef.current.has(chatId))) {
        return;
      }
      if (force) {
        dismissedMapChatIdsRef.current.delete(chatId);
      }
      setRightPanelMode((prev) => (prev === "trip-detail" && !force ? prev : "map"));
      setIsRightPanelCollapsed(false);
    },
    [chatId],
  );

  // Synchronize MapVina canvas resize when right split panel opens, closes, collapses, or toggles drawer expand
  const prevRightCollapsedRef = useRef(isRightPanelCollapsed);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const collapseTransitioned =
      prevRightCollapsedRef.current !== isRightPanelCollapsed;
    prevRightCollapsedRef.current = isRightPanelCollapsed;
    window.dispatchEvent(
      new CustomEvent("tripsense:sidebar-toggle", {
        detail: { durationMs: collapseTransitioned ? 300 : 0 },
      }),
    );
  }, [
    rightPanelMode,
    isRightPanelCollapsed,
    activeDetailPlace,
    isPlaceDetailExpanded,
  ]);

  // Abort inflight detail hydration when switching chats or unmounting
  useEffect(() => {
    detailAbortControllerRef.current?.abort();
    detailAbortControllerRef.current = null;
    detailRequestSeqRef.current += 1;
    return () => {
      detailAbortControllerRef.current?.abort();
    };
  }, [chatId]);

  const activeTripRef = useRef(activeTrip);
  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  // Tracks trip newly created from modal waiting for AI first response to name it
  const pendingTripTitleUpdateIdRef = useRef<string | null>(null);
  const attemptedTripLinkRef = useRef<string | null>(null);
  const announcedDraftTripRef = useRef<string | null>(null);
  const prevStatusRef = useRef(status);

  const [tripPreferences, setTripPreferences] = useState<TripPreferences>({});
  const tripPreferencesRef = useRef(tripPreferences);
  useEffect(() => {
    tripPreferencesRef.current = tripPreferences;
    syncTripContext?.({
      tripId: activeTrip?.id ?? null,
      tripPreferences,
    });
  }, [activeTrip?.id, tripPreferences, syncTripContext]);
  const [planningBriefVersion, setPlanningBriefVersion] = useState<number | null>(null);
  const [planningBriefStatus, setPlanningBriefStatus] = useState<string | null>(null);

  // Extract AI-generated themes for each day only when the TripDetailPanel is visible
  const dayThemes = useMemo(() => {
    if (!activeTrip || !isTripDetailOpen) {
      return EMPTY_DAY_THEMES;
    }
    const map: Record<number, string> = {};
    const parseMarkdownThemes = status !== "streaming";
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      if (Array.isArray(m.parts)) {
        for (const p of m.parts) {
          const res =
            (p as any)?.output ||
            (p as any)?.result ||
            (p as any)?.toolInvocation?.result ||
            (p as any)?.itineraryJson;
          if (res?.days && Array.isArray(res.days)) {
            for (const d of res.days) {
              if (d.dayNumber && d.theme) {
                map[d.dayNumber] = d.theme;
              }
            }
          }
          if (
            parseMarkdownThemes &&
            p &&
            typeof p === "object" &&
            (p as any).type === "text" &&
            typeof (p as any).text === "string"
          ) {
            extractThemesFromText((p as any).text, map);
          }
        }
      }
      if (parseMarkdownThemes && "content" in m && typeof (m as any).content === "string") {
        extractThemesFromText((m as any).content, map);
      }
    }
    return map;
  }, [activeTrip, isTripDetailOpen, messages, status]);

  // Share already-grounded Cloudinary/API photo URLs from chat tool outputs directly with TripDetailPanel
  const knownPlacePhotos = useMemo(() => {
    if (!activeTrip || !isTripDetailOpen) {
      return EMPTY_PLACE_PHOTOS;
    }
    const map: Record<string, string> = {};
    const recordPhoto = (key: unknown, url: unknown) => {
      if (
        typeof key === "string" &&
        key.trim() &&
        typeof url === "string" &&
        /^https?:\/\//i.test(url.trim())
      ) {
        map[key.trim()] = url.trim();
      }
    };

    for (const m of messages) {
      if (m.role !== "assistant" || !Array.isArray(m.parts)) continue;
      for (const p of m.parts) {
        const res =
          (p as any)?.output ||
          (p as any)?.result ||
          (p as any)?.toolInvocation?.result;
        if (!res || typeof res !== "object") continue;

        if (Array.isArray(res.days)) {
          for (const d of res.days) {
            if (!Array.isArray(d?.activities)) continue;
            for (const act of d.activities) {
              recordPhoto(act?.placeId, act?.photoUrl);
              recordPhoto(act?.itemKey, act?.photoUrl);
            }
          }
        }
        if (Array.isArray(res.places)) {
          for (const pl of res.places) {
            recordPhoto(pl?.id, pl?.photoUrl);
          }
        }
        if (Array.isArray(res.groups)) {
          for (const grp of res.groups) {
            if (!Array.isArray(grp?.places)) continue;
            for (const pl of grp.places) {
              recordPhoto(pl?.id, pl?.photoUrl);
            }
          }
        }
      }
    }

    return Object.keys(map).length > 0 ? map : EMPTY_PLACE_PHOTOS;
  }, [activeTrip, isTripDetailOpen, messages]);

  const scopedActiveItinerary =
    activeTrip?.id && activeItinerary?.tripId === activeTrip.id ? activeItinerary : null;

  const aiMapData = useMemo(
    () =>
      extractAiChatMapData({
        messages,
        activeTrip,
        itinerary: scopedActiveItinerary,
        placeSnapshots,
        selectedDayNumber: selectedMapDayNumber,
        selectedWhere: tripPreferences.where?.location,
      }),
    [
      messages,
      activeTrip,
      scopedActiveItinerary,
      placeSnapshots,
      selectedMapDayNumber,
      tripPreferences.where?.location,
    ],
  );

  const effectiveSelectedMapPlaceId = useMemo(
    () =>
      selectedMapPlaceId && aiMapData.places.some((p) => p.id === selectedMapPlaceId)
        ? selectedMapPlaceId
        : null,
    [selectedMapPlaceId, aiMapData.places],
  );

  const itineraryMeta = useMemo(() => {
    const itemIds = new Set<string>();
    const sourceOnlyKeys = new Set<string>();
    const scheduledCatalogPlaceIds = new Set<string>();
    if (scopedActiveItinerary?.days) {
      for (const day of scopedActiveItinerary.days) {
        for (const item of day.items ?? []) {
          itemIds.add(item.id);
          const ref = item.placeRef?.trim() || item.placeId?.trim();
          if (ref) {
            scheduledCatalogPlaceIds.add(ref);
          } else if (item.sourceItemKey?.trim()) {
            sourceOnlyKeys.add(item.sourceItemKey.trim());
          }
        }
      }
    }
    return { itemIds, sourceOnlyKeys, scheduledCatalogPlaceIds };
  }, [scopedActiveItinerary]);

  const activeDetailCanonicalId = useMemo(() => {
    if (!activeDetailPlace) return null;
    return (
      [activeDetailPlace.id, activeDetailPlace.providerPlaceId].find((id) =>
        isRealCatalogPlaceId(
          id,
          itineraryMeta.itemIds,
          itineraryMeta.sourceOnlyKeys,
        ),
      ) ?? null
    );
  }, [activeDetailPlace, itineraryMeta]);

  const detailPlaceRefs = useMemo(
    () => (activeDetailCanonicalId ? [activeDetailCanonicalId] : []),
    [activeDetailCanonicalId],
  );

  const { savedByPlace, tripsByPlace } = usePlaceActions(detailPlaceRefs);

  const isDetailFavorite = Boolean(
    activeDetailCanonicalId &&
      savedByPlace.get(activeDetailCanonicalId)?.saved,
  );

  const isDetailAddedToTrip = Boolean(
    activeDetailCanonicalId &&
      (tripsByPlace.get(activeDetailCanonicalId)?.added ||
        itineraryMeta.scheduledCatalogPlaceIds.has(activeDetailCanonicalId)),
  );

  const handleClosePlaceDetail = useCallback(() => {
    detailAbortControllerRef.current?.abort();
    detailAbortControllerRef.current = null;
    detailRequestSeqRef.current += 1;
    setPlaceDetailState(null);
    setSelectedMapPlaceId(null);
    setMapFitBoundsTrigger((prev) => prev + 1);
  }, []);

  const excludedPlaceNames = useMemo(() => {
    const names = [
      aiMapData.resolvedDestination,
      activeTrip?.destinationName,
      tripPreferences.where?.location,
    ].filter((n): n is string => Boolean(n && n.trim()));
    return Array.from(new Set(names));
  }, [
    aiMapData.resolvedDestination,
    activeTrip?.destinationName,
    tripPreferences.where?.location,
  ]);

  const placeMentionTargets = useMemo(
    () =>
      extractPlaceMentionTargets({
        messages,
        placeSnapshots,
        aiMapPlaces: aiMapData.places,
        itinerary: scopedActiveItinerary,
        excludedDestinationNames: excludedPlaceNames,
      }),
    [
      messages,
      placeSnapshots,
      aiMapData.places,
      scopedActiveItinerary,
      excludedPlaceNames,
    ],
  );

  const handleOpenPlaceDetail = useCallback(
    async (target: OpenPlaceDetailTarget) => {
      detailAbortControllerRef.current?.abort();
      const controller = new AbortController();
      detailAbortControllerRef.current = controller;
      const requestSeq = ++detailRequestSeqRef.current;
      const requestChatId = chatId;

      const lookup = buildChatPlaceLookup({
        messages,
        placeSnapshots,
        aiMapPlaces: aiMapData.places,
        itinerary: scopedActiveItinerary,
      });

      const initialPlace = toCanonicalDetailPlace({
        ...target,
        lookup,
      });

      // Ensure no floating map popup lingers underneath or after closing Place Detail
      setSelectedMapPlaceId(null);
      setIsRightPanelCollapsed(false);
      setPlaceDetailState((prev) => ({
        chatId: requestChatId,
        place: initialPlace,
        isLoading: true,
        isExpanded: prev?.chatId === requestChatId ? prev.isExpanded : false,
      }));

      try {
        const hydrated = await resolveAndHydrateChatPlace({
          initialPlace,
          destinationHint:
            aiMapData.resolvedDestination ||
            activeTrip?.destinationName ||
            tripPreferences.where?.location,
          destinationCenter: aiMapData.destinationPin
            ? {
                lat: aiMapData.destinationPin.lat,
                lng: aiMapData.destinationPin.lng,
              }
            : null,
          lookup,
          detailsCache: placeDetailsCacheRef.current,
          photoCheckedAtCache: photoCheckedAtCacheRef.current,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          detailRequestSeqRef.current !== requestSeq
        ) {
          return;
        }

        if (hydrated) {
          setPlaceDetailState((prev) => ({
            chatId: requestChatId,
            place: hydrated,
            isLoading: false,
            isExpanded: prev?.chatId === requestChatId ? prev.isExpanded : false,
          }));
        }
      } finally {
        if (
          !controller.signal.aborted &&
          detailRequestSeqRef.current === requestSeq
        ) {
          setPlaceDetailState((prev) =>
            prev && prev.chatId === requestChatId
              ? { ...prev, isLoading: false }
              : prev,
          );
        }
      }
    },
    [
      activeTrip?.destinationName,
      aiMapData.destinationPin,
      aiMapData.places,
      aiMapData.resolvedDestination,
      chatId,
      messages,
      placeSnapshots,
      scopedActiveItinerary,
      tripPreferences.where?.location,
    ],
  );

  const handleToggleDetailFavorite = useCallback(() => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!activeDetailPlace || !activeDetailCanonicalId) {
      toast.info(t("aiPlanner.placeNotCataloged"));
      return;
    }
    setSaveDialogState({
      chatId,
      place: {
        ...activeDetailPlace,
        id: activeDetailCanonicalId,
      },
    });
  }, [activeDetailCanonicalId, activeDetailPlace, chatId, isAuthenticated, t]);

  const handleAddDetailToTrip = useCallback(() => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!activeDetailPlace || !activeDetailCanonicalId) {
      toast.info(t("aiPlanner.placeNotCataloged"));
      return;
    }
    setTripDialogState({
      chatId,
      place: {
        ...activeDetailPlace,
        id: activeDetailCanonicalId,
      },
    });
  }, [activeDetailCanonicalId, activeDetailPlace, chatId, isAuthenticated, t]);

  const hasUnderlyingRightPanel =
    rightPanelMode === "map" ||
    (Boolean(activeTrip) && rightPanelMode === "trip-detail");
  const showRightPane = hasUnderlyingRightPanel || Boolean(activeDetailPlace);
  const isCollapsedRightStrip = isRightPanelCollapsed && !activeDetailPlace;
  const showFloatingTripDrawer =
    Boolean(activeTrip) && rightPanelMode === "trip-detail";

  // Keep itinerary coordinates synced with ChatZioMapPanel whenever a trip is linked or mutated
  useEffect(() => {
    if (!activeTrip?.id || !isAuthenticated) return;
    const tripId = activeTrip.id;
    let active = true;

    const loadItinerary = () => {
      void getItinerary(tripId)
        .then((res) => {
          if (active) setActiveItinerary(res);
        })
        .catch(() => {});
    };

    loadItinerary();
    const handleUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ tripId?: string }>).detail;
      if (!detail?.tripId || detail.tripId === tripId) {
        loadItinerary();
      }
    };
    window.addEventListener("tripsense:itinerary-updated", handleUpdated);
    return () => {
      active = false;
      window.removeEventListener("tripsense:itinerary-updated", handleUpdated);
    };
  }, [activeTrip?.id, isAuthenticated]);

  // Hydrate missing coordinates from Place Service snapshots at most once per placeId
  useEffect(() => {
    const toFetch = aiMapData.missingPlaceIds.filter(
      (id) => !attemptedSnapshotIdsRef.current.has(id),
    );
    if (toFetch.length === 0) return;

    for (const id of toFetch) {
      attemptedSnapshotIdsRef.current.add(id);
    }

    let active = true;
    const controller = new AbortController();
    void getPlaceBatchSnapshots(toFetch, false, controller.signal)
      .then((snapshots) => {
        if (!active || Object.keys(snapshots).length === 0) return;
        setPlaceSnapshots((prev) => ({ ...prev, ...snapshots }));
      })
      .catch(() => {});

    return () => {
      active = false;
      controller.abort();
    };
  }, [aiMapData.missingPlaceIds]);

  // Auto-open ZioMap on desktop when AI returns places or chat acquires destination context
  const lastAutoOpenedChatContextRef = useRef<string>("");
  useEffect(() => {
    if (rightPanelMode !== "closed" || dismissedMapChatIdsRef.current.has(chatId)) {
      return;
    }
    const triggerContext =
      aiMapData.places.length > 0
        ? `${chatId}:places:${aiMapData.placesSignature}`
        : aiMapData.resolvedDestination
          ? `${chatId}:dest:${aiMapData.resolvedDestination}`
          : "";
    if (!triggerContext || lastAutoOpenedChatContextRef.current === triggerContext) {
      return;
    }
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 768px)").matches) {
      return;
    }
    lastAutoOpenedChatContextRef.current = triggerContext;
    const timer = window.setTimeout(() => {
      openDesktopMapIfAllowed(false);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    chatId,
    rightPanelMode,
    aiMapData.places.length,
    aiMapData.placesSignature,
    aiMapData.resolvedDestination,
    openDesktopMapIfAllowed,
  ]);

  // Load trip from URL query (?tripId=...) if present
  useEffect(() => {
    if (!tripIdParam) return;
    if (activeTrip && activeTrip.id === tripIdParam) return;

    let isMounted = true;
    getTrip(tripIdParam)
      .then((trip) => {
        if (isMounted) {
          setActiveTrip(trip);
          const flexInfo = parseFlexiblePreferenceFromNotes(trip.notes);
          setTripPreferences({
            where: { location: trip.destinationName, isRoadTrip: false },
            when: flexInfo
              ? {
                  type: "flexible",
                  durationDays: flexInfo.durationDays,
                  flexibleMonths: flexInfo.flexibleMonths,
                  startDate: trip.startDate,
                  endDate: trip.endDate,
                }
              : { type: "dates", startDate: trip.startDate, endDate: trip.endDate },
            who: trip.travelerCount
              ? { adults: trip.travelerCount, children: 0, infants: 0, pets: 0 }
              : undefined,
            budget: trip.budgetAmount != null && trip.budgetCurrency
              ? { mode: "TOTAL", amount: trip.budgetAmount, currency: trip.budgetCurrency }
              : { mode: "FLEXIBLE" },
          });
          openDesktopMapIfAllowed(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load trip from query param:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [tripIdParam, activeTrip?.id, openDesktopMapIfAllowed]);

  // Listen for explicit open-trip-detail event from chat messages or intake card
  useEffect(() => {
    const handleOpenDetail = () => {
      setRightPanelMode("trip-detail");
      setIsRightPanelCollapsed(false);
    };
    window.addEventListener("tripsense:open-trip-detail", handleOpenDetail);
    return () => {
      window.removeEventListener("tripsense:open-trip-detail", handleOpenDetail);
    };
  }, []);

  // An explicit ?tripId selection links an unlinked chat, but never silently
  // replaces a different persisted mapping.
  useEffect(() => {
    if (!isAuthenticated || !tripIdParam) return;
    const attemptKey = `${chatId}:${tripIdParam}`;
    if (attemptedTripLinkRef.current === attemptKey) return;
    attemptedTripLinkRef.current = attemptKey;
    void getChatTripContext(chatId)
      .then(async (context) => {
        if (context.trip?.id === tripIdParam) return;
        if (context.trip) {
          toast.info(
            locale === "vi"
              ? `Đoạn chat vẫn đang liên kết với “${context.trip.name}”.`
              : `This chat remains linked to “${context.trip.name}”.`,
          );
          return;
        }
        await linkChatToTrip(chatId, tripIdParam, null);
        const qc = getQueryClient();
        void qc.invalidateQueries({ queryKey: aiChatQueryKeys.all });
      })
      .catch((err) => {
        console.warn("Could not link trip to chat on mount:", err);
      });
  }, [chatId, isAuthenticated, locale, tripIdParam]);

  // Auto-send initial prompt from trip creation handoff (Mindtrip flow)
  const initialPromptDispatchedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !tripIdParam || initialPromptDispatchedRef.current) return;
    const pendingPrompt = sessionStorage.getItem("tripsense:initial-ai-prompt");
    if (!pendingPrompt) return;

    initialPromptDispatchedRef.current = true;
    sessionStorage.removeItem("tripsense:initial-ai-prompt");

    const timer = setTimeout(() => {
      sendMessage({
        parts: [{ text: pendingPrompt.trim(), type: "text" }],
        role: "user",
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [tripIdParam, sendMessage]);

  // Restore the trip linked to this AI conversation, including after an AI commit.
  useEffect(() => {
    if (!isAuthenticated || tripIdParam) return;
    let isMounted = true;
    const loadLinkedTrip = async (expectedChatId = chatId) => {
      try {
        const context = await getChatTripContext(expectedChatId);
        if (!isMounted || !context.trip) return;
        const trip = await getTrip(context.trip.id);
        if (isMounted) {
          setActiveTrip(trip);
          const flexInfo = parseFlexiblePreferenceFromNotes(trip.notes);
          setTripPreferences((prev) => {
            const isFlexible = Boolean(flexInfo || prev.when?.type === "flexible");
            return {
              where: { location: trip.destinationName, isRoadTrip: false },
              when: isFlexible
                ? {
                    type: "flexible",
                    durationDays:
                      flexInfo?.durationDays || prev.when?.durationDays || 3,
                    flexibleMonths:
                      flexInfo?.flexibleMonths || prev.when?.flexibleMonths || [],
                    startDate: trip.startDate,
                    endDate: trip.endDate,
                  }
                : { type: "dates", startDate: trip.startDate, endDate: trip.endDate },
              who: trip.travelerCount
                ? { adults: trip.travelerCount, children: 0, infants: 0, pets: 0 }
                : prev.who,
              budget:
                trip.budgetAmount != null && trip.budgetCurrency
                  ? {
                      mode: "TOTAL",
                      amount: trip.budgetAmount,
                      currency: trip.budgetCurrency,
                    }
                  : prev.budget || { mode: "FLEXIBLE" },
            };
          });
        }
      } catch {
        // A chat without a trip is a valid state.
      }
    };
    void loadLinkedTrip();
    const onLinked = (event: Event) => {
      const detail = (event as CustomEvent<{ chatId: string; tripId?: string }>).detail;
      if (detail?.chatId === chatId) {
        openDesktopMapIfAllowed(false);
        if (detail.tripId && activeTripRef.current?.id === detail.tripId) {
          return;
        }
        void loadLinkedTrip(detail.chatId);
      }
    };
    window.addEventListener("tripsense:chat-trip-linked", onLinked);
    return () => {
      isMounted = false;
      window.removeEventListener("tripsense:chat-trip-linked", onLinked);
    };
  }, [chatId, isAuthenticated, tripIdParam, openDesktopMapIfAllowed]);

  // Restore partial Where/When/Who/Budget answers before a Trip exists.
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    let isMounted = true;
    void getPlanningBrief(chatId)
      .then(async (response) => {
        if (!isMounted) return;
        setPlanningBriefVersion(response.state?.version ?? null);
        setPlanningBriefStatus(response.state?.status ?? null);
        if (response.trip) {
          const trip = await getTrip(response.trip.id);
          if (!isMounted) return;
          setActiveTrip(trip);
          const brief = response.state?.brief;
          const flexInfo = parseFlexiblePreferenceFromNotes(trip.notes);
          const isFlexible = Boolean(
            flexInfo ||
            (brief?.when as any)?.type === "flexible" ||
            (brief?.when as any)?.durationDays
          );
          setTripPreferences({
            where: { location: trip.destinationName, isRoadTrip: false },
            when: isFlexible
              ? {
                  type: "flexible",
                  durationDays:
                    flexInfo?.durationDays ||
                    (brief?.when as any)?.durationDays ||
                    3,
                  flexibleMonths:
                    flexInfo?.flexibleMonths ||
                    (brief?.when as any)?.flexibleMonths ||
                    [],
                  startDate: trip.startDate,
                  endDate: trip.endDate,
                }
              : { type: "dates", startDate: trip.startDate, endDate: trip.endDate },
            who: trip.travelerCount
              ? { adults: trip.travelerCount, children: 0, infants: 0, pets: 0 }
              : undefined,
            budget: trip.budgetAmount != null && trip.budgetCurrency
              ? { mode: "TOTAL", amount: trip.budgetAmount, currency: trip.budgetCurrency }
              : { mode: "FLEXIBLE" },
          });
          if (announcedDraftTripRef.current !== trip.id) {
            announcedDraftTripRef.current = trip.id;
            toast.success(t("aiPlanner.tripCreated", { tripName: trip.name }), {
              id: `trip-created-${trip.id}`,
              action: {
                label: t("aiPlanner.viewTrip"),
                onClick: () => {
                  setRightPanelMode("trip-detail");
                  setIsRightPanelCollapsed(false);
                },
              },
            });
          }
          return;
        }
        const brief = response.state?.brief;
        setTripPreferences({
          where: brief?.where
            ? { location: brief.where.destinationText, isRoadTrip: false }
            : undefined,
          when: brief?.when
            ? {
                type:
                  (brief.when as any).type ||
                  ((brief.when as any).durationDays ? "flexible" : brief.when.startDate ? "dates" : "flexible"),
                startDate: brief.when.startDate,
                endDate: brief.when.endDate,
                durationDays: (brief.when as any).durationDays,
                flexibleMonths: (brief.when as any).flexibleMonths,
              }
            : undefined,
          who: brief?.who,
          budget: brief?.budget,
        });
      })
      .catch(() => {
        // A chat without an intake is a valid state.
      });
    return () => {
      isMounted = false;
    };
  }, [chatId, status, t]);

  const persistBriefPatch = useCallback(
    async (patch: Partial<TripPlanningBrief>) => {
      if (planningBriefVersion == null) return;
      try {
        const result = await patchPlanningBrief({
          chatId,
          expectedVersion: planningBriefVersion,
          patch,
        });
        setPlanningBriefVersion(result.state.version);
        const shouldContinuePlanning =
          result.state.status === "TRIP_LINKED" &&
          planningBriefStatus !== "TRIP_LINKED" &&
          planningBriefStatus !== "COMPLETED";
        setPlanningBriefStatus(result.state.status);
        if (result.state.tripId) {
          window.dispatchEvent(
            new CustomEvent("tripsense:chat-trip-linked", {
              detail: { chatId, tripId: result.state.tripId },
            }),
          );
          if (shouldContinuePlanning) {
            sendMessage({
              parts: [{ type: "text", text: t("aiPlanner.continuePlanningPrompt") }],
              role: "user",
            });
          }
        }
      } catch {
        toast.error(t("aiPlanner.commitError"));
      }
    }, [chatId, planningBriefStatus, planningBriefVersion, sendMessage, t],
  );

  // Handle "Create a trip" click: Enforce authentication
  const handleOpenCreateTrip = useCallback(() => {
    if (!isAuthenticated) {
      toast.error(
        locale === "vi"
          ? "Vui lòng đăng nhập để tạo chuyến đi."
          : "Please sign in to create a trip."
      );
      setIsAuthModalOpen(true);
      return;
    }
    setIsCreateTripOpen(true);
  }, [isAuthenticated, locale]);

  // Link trip to current conversation without sending any message/prompt
  const linkCreatedTrip = useCallback(
    async (newTrip: TripResponse) => {
      activeTripRef.current = newTrip;
      setActiveTrip(newTrip);
      syncTripContext?.({
        tripId: newTrip.id,
        tripPreferences: tripPreferencesRef.current,
      });
      openDesktopMapIfAllowed(false);
      pendingTripTitleUpdateIdRef.current = newTrip.id;

      // Link chat to trip first to establish authoritative context
      try {
        await linkChatToTrip(chatId, newTrip.id, null);
      } catch {
        toast.error(
          locale === "vi"
            ? "Trip đã được tạo nhưng chưa thể liên kết với đoạn chat này."
            : "The trip was created but could not be linked to this chat.",
        );
      }

      // Sync URL without reloading
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("tripId", newTrip.id);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [chatId, locale, syncTripContext, openDesktopMapIfAllowed]
  );

  // Handle Trip Created from modal: links trip AND dispatches prompt to AI
  const handleTripCreatedWithPrompt = useCallback(
    async (newTrip: TripResponse, initialPrompt?: string) => {
      await linkCreatedTrip(newTrip);

      // Compute duration in days
      let durationDays = 3;
      if (newTrip.startDate && newTrip.endDate) {
        const start = Date.parse(`${newTrip.startDate}T00:00:00Z`);
        const end = Date.parse(`${newTrip.endDate}T00:00:00Z`);
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          durationDays = Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
        }
      }

      const travelers = newTrip.travelerCount;
      const dest = newTrip.destinationName;

      // Clean prompt visible to the user on UI
      const travelerTextVi = travelers ? `, ${travelers} khách` : "";
      const travelerTextEn = travelers ? ` (${travelers} traveler${travelers > 1 ? "s" : ""})` : "";
      const userFacingText = initialPrompt?.trim()
        ? initialPrompt.trim()
        : locale === "vi"
        ? `Lên lịch trình du lịch ${dest} (${durationDays} ngày${travelerTextVi})`
        : `Plan a ${durationDays}-day trip to ${dest}${travelerTextEn}`;

      // Hidden directive for AI: instructs Gemini to reuse prefetched candidates or prepareTripCandidates and generate the complete multi-day proposal
      const travelerDirective = travelers ? `, ${travelers} khách` : "";
      const hiddenDirective = `<!-- ai-directive: Người dùng vừa tạo chuyến đi "${newTrip.name}" đến ${dest} (${durationDays} ngày${travelerDirective}). Hãy ưu tiên sử dụng trực tiếp các địa điểm đã nạp sẵn trong ngữ cảnh hệ thống (hoặc gọi prepareTripCandidates nếu chưa có) rồi gọi ngay createTripProposal để sinh lịch trình hoàn chỉnh chi tiết cho tất cả ${durationDays} ngày. Không hỏi lại các thông tin cơ bản. -->`;

      const fullMessageText = `${userFacingText}\n\n${hiddenDirective}`;

      sendMessage({
        parts: [{ text: fullMessageText, type: "text" }],
        role: "user",
      });
    },
    [linkCreatedTrip, locale, sendMessage]
  );

  // Auto-create trip and link to current conversation when both Where & When are satisfied (NO automatic prompt sent)
  const isAutoCreatingTripRef = useRef(false);
  const autoCreateAndLinkTrip = useCallback(
    async (
      destination: string,
      whenData?: TripPreferences["when"],
      whoData?: TripPreferences["who"]
    ) => {
      if (!destination || !destination.trim()) return;
      if (!whenData || (!whenData.startDate && !whenData.durationDays)) return;
      if (activeTripRef.current || isAutoCreatingTripRef.current) return;

      if (!isAuthenticated) {
        toast.info(t("aiPlanner.autoCreateTripPromptLogin"));
        setIsAuthModalOpen(true);
        return;
      }

      try {
        isAutoCreatingTripRef.current = true;
        const finalDest = destination.trim();
        const tripName = locale === "vi" ? `Chuyến đi ${finalDest}` : `Trip to ${finalDest}`;

        let finalStartDate = whenData.startDate;
        let finalEndDate = whenData.endDate;
        if (!finalStartDate || !finalEndDate) {
          const resolved = resolveFlexibleDates(
            whenData.durationDays || 3,
            whenData.flexibleMonths || []
          );
          finalStartDate = finalStartDate || resolved.startDate || isoDateFromToday(7);
          finalEndDate = finalEndDate || resolved.endDate || isoDateFromToday(10);
        }

        const totalTravelers = whoData
          ? whoData.adults + whoData.children + whoData.infants
          : undefined;

        const travelerBreakdown = whoData
          ? [
              `${whoData.adults} adult${whoData.adults > 1 ? "s" : ""}`,
              whoData.children > 0
                ? `${whoData.children} child${whoData.children > 1 ? "ren" : ""}`
                : null,
              whoData.infants > 0
                ? `${whoData.infants} infant${whoData.infants > 1 ? "s" : ""}`
                : null,
              whoData.pets > 0
                ? `${whoData.pets} pet${whoData.pets > 1 ? "s" : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(", ")
          : null;

        const flexibleNote =
          whenData.type === "flexible"
            ? `Travel preference: ${whenData.durationDays || 3} days flexible${
                whenData.flexibleMonths && whenData.flexibleMonths.length > 0
                  ? ` (${whenData.flexibleMonths.join(", ")})`
                  : ""
              }`
            : null;

        const combinedNotes = [
          flexibleNote,
          travelerBreakdown ? `Travelers: ${travelerBreakdown}` : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        const newTrip = await createTrip({
          name: tripName,
          destinationName: finalDest,
          startDate: finalStartDate,
          endDate: finalEndDate,
          travelerCount: totalTravelers && totalTravelers > 0 ? totalTravelers : undefined,
          notes: combinedNotes || undefined,
        });

        toast.success(
          t("aiPlanner.tripCreated", { tripName: newTrip.name })
        );

        await linkCreatedTrip(newTrip);
      } catch (err) {
        console.error("Auto trip creation failed:", err);
        toast.error(t("aiPlanner.autoCreateTripFailed"));
      } finally {
        isAutoCreatingTripRef.current = false;
      }
    },
    [isAuthenticated, locale, t, linkCreatedTrip]
  );

  // When user signs in and where+when were already selected, auto create the trip
  useEffect(() => {
    if (
      isAuthenticated &&
      !activeTrip &&
      tripPreferences.where?.location?.trim() &&
      (tripPreferences.when?.startDate || tripPreferences.when?.durationDays) &&
      !isAutoCreatingTripRef.current
    ) {
      void autoCreateAndLinkTrip(
        tripPreferences.where.location.trim(),
        tripPreferences.when,
        tripPreferences.who
      );
    }
  }, [
    isAuthenticated,
    activeTrip,
    tripPreferences.where?.location,
    tripPreferences.when,
    tripPreferences.who,
    autoCreateAndLinkTrip,
  ]);

  // Monitor first AI response to automatically name the trip (Decision 2)
  useEffect(() => {
    const pendingId = pendingTripTitleUpdateIdRef.current;
    if (!pendingId || !activeTrip || activeTrip.id !== pendingId) return;

    // Check Source 1: AI createTripProposal tool returned an official proposal title
    const proposalTitle = artifact.proposal?.title?.trim();
    if (proposalTitle && proposalTitle.length >= 4) {
      pendingTripTitleUpdateIdRef.current = null;
      void updateTrip(activeTrip.id, { name: proposalTitle })
        .then((updated) => {
          setActiveTrip(updated);
          toast.success(
            locale === "vi"
              ? `AI đã đặt tên chuyến đi: "${updated.name}"`
              : `AI named your trip: "${updated.name}"`
          );
        })
        .catch(() => {});
      return;
    }

    // Check Source 2: Streaming just finished (transitioned from streaming to ready)
    const justFinishedStreaming =
      prevStatusRef.current === "streaming" && status === "ready";
    prevStatusRef.current = status;

    if (justFinishedStreaming) {
      const lastAssistantMsg = [...messages]
        .reverse()
        .find((m) => m.role === "assistant");
      let extractedTitle: string | null = null;

      if (lastAssistantMsg) {
        let textContent = "";
        if (
          "content" in lastAssistantMsg &&
          typeof (lastAssistantMsg as { content?: unknown }).content === "string"
        ) {
          textContent = (lastAssistantMsg as { content: string }).content;
        } else if (
          "parts" in lastAssistantMsg &&
          Array.isArray(lastAssistantMsg.parts)
        ) {
          textContent = (lastAssistantMsg.parts as unknown[])
            .filter(
              (p): p is { type: "text"; text: string } =>
                Boolean(
                  p &&
                    typeof p === "object" &&
                    "type" in p &&
                    (p as { type: unknown }).type === "text" &&
                    "text" in p &&
                    typeof (p as { text: unknown }).text === "string"
                )
            )
            .map((p) => p.text)
            .join("\n");
        }

        // Look for Markdown header: # Khám phá Tokyo...
        const headerMatch = textContent.match(/^#+\s*(.+?)$/m);
        if (headerMatch && headerMatch[1]) {
          const raw = headerMatch[1].replace(/[*_#]/g, "").trim();
          if (raw.length >= 4 && raw.length <= 60) {
            extractedTitle = raw;
          }
        }

        // Look for bold text **Chuyến đi...**
        if (!extractedTitle) {
          const boldMatch = textContent.match(/\*\*(.+?)\*\*/);
          if (boldMatch && boldMatch[1]) {
            const raw = boldMatch[1].trim();
            if (
              raw.length >= 4 &&
              raw.length <= 60 &&
              !raw.toLowerCase().includes("ngân sách") &&
              !raw.toLowerCase().includes("lưu ý")
            ) {
              extractedTitle = raw;
            }
          }
        }
      }

      // Fallback: If chatTitle was updated by generateSmartTitle in ai-service
      if (
        !extractedTitle &&
        chatTitle &&
        !isGenericChatTitle(chatTitle)
      ) {
        extractedTitle = chatTitle;
      }

      if (extractedTitle) {
        pendingTripTitleUpdateIdRef.current = null;
        void updateTrip(activeTrip.id, { name: extractedTitle })
          .then((updated) => {
            setActiveTrip(updated);
            toast.success(
              locale === "vi"
                ? `AI đã đặt tên chuyến đi: "${updated.name}"`
                : `AI named your trip: "${updated.name}"`
            );
          })
          .catch(() => {});
      }
    } else {
      prevStatusRef.current = status;
    }
  }, [
    status,
    messages,
    artifact.proposal?.title,
    chatTitle,
    activeTrip,
    locale,
  ]);

  // Reactive Auto-Update: Refresh TripDetailPanel once when an itinerary-mutating turn completes
  const wasStreamingTrackerRef = useRef(false);
  useEffect(() => {
    if (status === "streaming") {
      wasStreamingTrackerRef.current = true;
      return;
    }
    if (status === "ready" && wasStreamingTrackerRef.current) {
      wasStreamingTrackerRef.current = false;
      if (!activeTrip?.id) return;

      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      const didMutateItinerary = Boolean(
        lastAssistantMsg?.parts?.some((part: any) => {
          const toolName =
            (typeof part?.type === "string" && part.type.startsWith("tool-")
              ? part.type.slice(5)
              : undefined) || part?.toolInvocation?.toolName;
          return toolName ? ITINERARY_MUTATING_TOOLS.has(toolName) : false;
        })
      );

      if (didMutateItinerary) {
        window.dispatchEvent(
          new CustomEvent("tripsense:itinerary-updated", {
            detail: { tripId: activeTrip.id },
          }),
        );
      }
    }
  }, [status, activeTrip?.id, messages]);

  const headerChatTitle = useMemo(() => {
    if (chatTitle && !isGenericChatTitle(chatTitle)) {
      return chatTitle;
    }
    if (activeTrip?.destinationName) {
      return locale === "vi"
        ? `Lịch trình ${activeTrip.destinationName}`
        : `Trip to ${activeTrip.destinationName}`;
    }
    if (activeTrip?.name) {
      return activeTrip.name;
    }
    return chatTitle;
  }, [chatTitle, activeTrip?.destinationName, activeTrip?.name, locale]);

  const sendMessageWithMapAutoOpen = useCallback(
    (payload: Parameters<typeof sendMessage>[0]) => {
      if (
        payload &&
        typeof payload === "object" &&
        "parts" in payload &&
        Array.isArray(payload.parts)
      ) {
        const text = (payload.parts as Array<{ text?: unknown }>)
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .join(" ");
        if (inferDestinationFromPrompt(text)) {
          openDesktopMapIfAllowed(false);
        }
      }
      return sendMessage(payload);
    },
    [sendMessage, openDesktopMapIfAllowed],
  );

  const handleQuickReply = useCallback(
    (promptText: string) => {
      const trimmed = promptText.trim();
      if (!trimmed) return;
      sendMessageWithMapAutoOpen({
        parts: [{ text: trimmed, type: "text" }],
        role: "user",
      });
    },
    [sendMessageWithMapAutoOpen]
  );

  return (
    <div className="relative isolate flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Mindtrip-Style Chat Header (Always full-width across the top; Trip & Place drawers slide over its right half) */}
      <ChatHeader
        chatId={chatId}
        chatTitle={headerChatTitle}
        onNewChat={startNewChat}
        onOpenHistory={toggleDrawer}
        onRenameChat={renameChat}
        onDeleteChat={() => deleteChat(chatId)}
        isBackendReady={isBackendReady}
        historyCount={chatList.length}
        tripPreferences={tripPreferences}
        onOpenWhere={() => setActiveModal("where")}
        onOpenWhen={() => setActiveModal("when")}
        onOpenWho={() => setActiveModal("who")}
        onOpenBudget={() => setActiveModal("budget")}
        onCreateTripClick={handleOpenCreateTrip}
        activeTrip={activeTrip}
        isTripDetailOpen={isTripDetailOpen}
        onToggleTripDetail={() => {
          handleClosePlaceDetail();
          setIsRightPanelCollapsed(false);
          setRightPanelMode((prev) =>
            prev === "trip-detail" ? "map" : "trip-detail",
          );
        }}
        isMapOpen={isMapPanelOpen}
        onToggleMap={() => {
          handleClosePlaceDetail();
          if (rightPanelMode === "map") {
            dismissedMapChatIdsRef.current.add(chatId);
            setRightPanelMode("closed");
          } else {
            dismissedMapChatIdsRef.current.delete(chatId);
            setIsRightPanelCollapsed(false);
            setRightPanelMode("map");
          }
        }}
      />

      {/* Modals for Where, When, Who, Budget */}
      <WhereModal
        isOpen={activeModal === "where"}
        onClose={() => setActiveModal(null)}
        initialLocation={tripPreferences.where?.location}
        initialRoadTrip={tripPreferences.where?.isRoadTrip}
        onSave={(data) => {
          setTripPreferences((prev) => ({ ...prev, where: data }));
          setSelectedMapDayNumber(null);
          setSelectedMapPlaceId(null);
          openDesktopMapIfAllowed(true);
          void persistBriefPatch({
            where: { destinationText: data.location, destinationPlaceRef: null },
          });
          if (
            !activeTrip &&
            data.location.trim() &&
            (tripPreferences.when?.startDate || tripPreferences.when?.durationDays)
          ) {
            void autoCreateAndLinkTrip(
              data.location.trim(),
              tripPreferences.when,
              tripPreferences.who
            );
          }
        }}
      />

      <WhenModal
        isOpen={activeModal === "when"}
        onClose={() => setActiveModal(null)}
        initialType={tripPreferences.when?.type}
        initialStartDate={tripPreferences.when?.startDate}
        initialEndDate={tripPreferences.when?.endDate}
        initialDurationDays={tripPreferences.when?.durationDays}
        initialFlexibleMonths={tripPreferences.when?.flexibleMonths}
        onSave={(data) => {
          setTripPreferences((prev) => ({ ...prev, when: data }));
          if (data.type === "dates" && data.startDate && data.endDate) {
            void persistBriefPatch({
              when: {
                type: "dates",
                startDate: data.startDate,
                endDate: data.endDate,
              },
            });
          } else if (data.type === "flexible") {
            void persistBriefPatch({
              when: {
                type: "flexible",
                durationDays: data.durationDays,
                flexibleMonths: data.flexibleMonths,
                startDate: data.startDate,
                endDate: data.endDate,
              },
            });
          }
          if (
            !activeTrip &&
            tripPreferences.where?.location?.trim() &&
            (data.startDate || data.durationDays)
          ) {
            void autoCreateAndLinkTrip(
              tripPreferences.where.location.trim(),
              data,
              tripPreferences.who
            );
          }
        }}
      />

      <WhoModal
        isOpen={activeModal === "who"}
        onClose={() => setActiveModal(null)}
        initialCounts={tripPreferences.who}
        onSave={(counts) => {
          setTripPreferences((prev) => ({ ...prev, who: counts }));
          void persistBriefPatch({ who: counts });
        }}
      />

      <BudgetModal
        isOpen={activeModal === "budget"}
        onClose={() => setActiveModal(null)}
        initialBudget={
          typeof tripPreferences.budget === "string"
            ? tripPreferences.budget
            : "any"
        }
        onSave={(budget) => {
          setTripPreferences((prev) => ({ ...prev, budget }));
          if (budget === "any") {
            void persistBriefPatch({ budget: { mode: "FLEXIBLE" } });
          }
        }}
      />

      {/* Mindtrip Create Trip Modal */}
      <CreateTripModal
        isOpen={isCreateTripOpen}
        onClose={() => setIsCreateTripOpen(false)}
        onTripCreated={handleTripCreatedWithPrompt}
        onRequireAuth={() => {
          setIsCreateTripOpen(false);
          setIsAuthModalOpen(true);
        }}
        initialDestination={tripPreferences.where?.location}
        initialWhenType={tripPreferences.when?.type}
        initialStartDate={tripPreferences.when?.startDate}
        initialEndDate={tripPreferences.when?.endDate}
        initialDurationDays={tripPreferences.when?.durationDays}
        initialFlexibleMonths={tripPreferences.when?.flexibleMonths}
        initialTravelers={
          tripPreferences.who
              ? tripPreferences.who.adults + tripPreferences.who.children + tripPreferences.who.infants
              : 1
        }
      />

      {/* Auth Modal for Unauthenticated Users */}
      <AuthModal
        open={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
      />

      {/* Save / Add to Trip Dialogs triggered from Place Detail Overlay */}
      <SaveToCollectionDialog
        key={
          saveDialogPlace
            ? `${saveDialogPlace.id}:${[...(savedByPlace.get(saveDialogPlace.id)?.collectionIds ?? [])].sort().join(",")}`
            : "chat-save-dialog"
        }
        open={Boolean(saveDialogPlace)}
        onOpenChange={(open) => {
          if (!open) setSaveDialogState(null);
        }}
        place={saveDialogPlace}
        selectedCollectionIds={
          saveDialogPlace
            ? savedByPlace.get(saveDialogPlace.id)?.collectionIds ?? []
            : []
        }
      />

      <AddToTripDialog
        key={
          tripDialogPlace
            ? `${tripDialogPlace.id}:${[...(tripsByPlace.get(tripDialogPlace.id)?.tripIds ?? [])].sort().join(",")}`
            : "chat-trip-dialog"
        }
        open={Boolean(tripDialogPlace)}
        onOpenChange={(open) => {
          if (!open) setTripDialogState(null);
        }}
        place={tripDialogPlace}
        selectedTripIds={
          tripDialogPlace
            ? tripsByPlace.get(tripDialogPlace.id)?.tripIds ?? []
            : []
        }
        onAdded={(tripId) => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("tripsense:itinerary-updated", {
                detail: { tripId: typeof tripId === "string" ? tripId : undefined },
              }),
            );
          }
        }}
      />

      {/* Main Content Workspace: Messages thread on left, TripDetailPanel on right */}
      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden bg-background">
        {/* Messages Thread Column (ONLY this column shrinks when TripDetailPanel opens!) */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background transition-all duration-300 ease-in-out">
          <Messages
            chatId={chatId}
            messages={messages}
            setMessages={setMessages}
            regenerate={regenerate}
            status={status}
            onQuickReply={handleQuickReply}
            onOpenPlaceDetail={(target) => {
              void handleOpenPlaceDetail(target);
            }}
            placeMentionTargets={placeMentionTargets}
            excludedPlaceNames={excludedPlaceNames}
            isLoading={
              isHistoryLoading ||
              status === "submitted" ||
              status === "streaming"
            }
          />

          {/* Sticky Composer Input */}
          <div className="sticky bottom-0 z-10 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background/95 px-2 pb-3 backdrop-blur-sm md:px-4 md:pb-4">
            <MultimodalInput
              chatId={chatId}
              input={input}
              setInput={setInput}
              messages={messages}
              sendMessage={sendMessageWithMapAutoOpen}
              selectedModelId={currentModelId}
              onModelChange={setCurrentModelId}
              status={status}
              stop={stop}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          </div>
        </div>

        {/* Right Flex Slot: renders ZioMap below header (preserving its exact size) or reserves width for elevated Trip / Place Detail drawers */}
        {showRightPane && (
          <div
            data-testid="chat-right-pane"
            className={cn(
              "flex h-full shrink-0 flex-col overflow-hidden bg-background select-none",
              isCollapsedRightStrip
                ? cn(
                    "relative z-20 w-14 transition-all duration-300 ease-in-out",
                    rightPanelMode === "map"
                      ? "rounded-l-xl rounded-r-none border-l border-border/70"
                      : "bg-transparent pointer-events-none",
                  )
                : rightPanelMode === "map"
                  ? cn(
                      "rounded-none md:rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l-0 md:border-l border-border/70 shadow-xl",
                      activeDetailPlace
                        ? isPlaceDetailExpanded
                          ? "hidden md:block md:w-[50%] lg:w-[52%] xl:w-[54%]"
                          : "absolute inset-0 z-20 w-full md:relative md:w-[50%] lg:w-[52%] xl:w-[54%]"
                        : "absolute inset-0 z-20 w-full md:relative md:w-[50%] lg:w-[48%] xl:w-[46%] transition-all duration-300 ease-in-out",
                    )
                  : activeDetailPlace && isPlaceDetailExpanded
                    ? "hidden"
                    : "hidden md:block md:w-[50%] lg:w-[52%] xl:w-[54%] bg-transparent pointer-events-none",
            )}
          >
            {/* Clean Mindtrip ZioMap Right Panel (Keeps original placement below ChatHeader & original width) */}
            {rightPanelMode === "map" && (
              <ChatZioMapPanel
                places={aiMapData.places}
                dayNumbers={aiMapData.dayNumbers}
                selectedDayNumber={selectedMapDayNumber}
                onSelectDayNumber={(day) => {
                  setSelectedMapDayNumber(day);
                  setSelectedMapPlaceId(null);
                }}
                selectedPlaceId={effectiveSelectedMapPlaceId}
                onSelectPlace={setSelectedMapPlaceId}
                destinationPin={aiMapData.destinationPin}
                resolvedDestination={aiMapData.resolvedDestination}
                weatherText={aiMapData.weatherText}
                isCollapsed={isCollapsedRightStrip}
                onToggleCollapse={() => setIsRightPanelCollapsed((prev) => !prev)}
                onClose={() => {
                  dismissedMapChatIdsRef.current.add(chatId);
                  setRightPanelMode("closed");
                }}
                fitBoundsTrigger={mapFitBoundsTrigger}
                onViewPlaceDetails={(place) => {
                  void handleOpenPlaceDetail({ place });
                }}
                className={cn(
                  !isCollapsedRightStrip &&
                    "static inset-auto w-full md:static md:w-full lg:w-full xl:w-full rounded-none border-l-0 shadow-none",
                )}
              />
            )}
          </div>
        )}
      </div>

      {/* Mindtrip Trip Detail Slide Drawer (Rises to top-0 over right part of ChatHeader when expanded, drops below ChatHeader when w-14 collapsed) */}
      <AnimatePresence initial={false}>
        {showFloatingTripDrawer && activeTrip && (
          <motion.div
            key="chat-trip-drawer"
            data-testid="chat-trip-drawer-host"
            initial={
              prefersReducedMotion ? false : { x: "100%", opacity: 0.96 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { x: "100%", opacity: 0.96 }
            }
            transition={drawerSlideTransition}
            className={cn(
              "flex flex-col overflow-hidden bg-background select-none transition-[top,width,border-radius] duration-300 ease-in-out",
              isCollapsedRightStrip
                ? "absolute top-14 right-0 bottom-0 z-20 w-14 rounded-l-xl rounded-r-none border-l border-border/70"
                : "absolute top-0 right-0 bottom-0 z-30 w-full md:w-[50%] lg:w-[52%] xl:w-[54%] rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border/70 shadow-xl",
            )}
          >
            <TripDetailPanel
              trip={activeTrip}
              dayThemes={dayThemes}
              knownPlacePhotos={knownPlacePhotos}
              onClose={() => setRightPanelMode("closed")}
              isCollapsed={isCollapsedRightStrip}
              onToggleCollapse={() =>
                setIsRightPanelCollapsed((prev) => !prev)
              }
              onOpenPlaceDetail={(item, knownPhotoUrl) => {
                void handleOpenPlaceDetail({ item, knownPhotoUrl });
              }}
              onOpenMap={(focusItemId) => {
                dismissedMapChatIdsRef.current.delete(chatId);
                setIsRightPanelCollapsed(false);
                if (focusItemId) {
                  setSelectedMapDayNumber(null);
                  setSelectedMapPlaceId(focusItemId);
                }
                setRightPanelMode("map");
              }}
              onTripUpdated={(updatedTrip) => {
                pendingTripTitleUpdateIdRef.current = null;
                setActiveTrip(updatedTrip);
              }}
              onTripDeleted={() => {
                setActiveTrip(null);
                setActiveItinerary(null);
                setRightPanelMode("closed");
                pendingTripTitleUpdateIdRef.current = null;
                if (typeof window !== "undefined") {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("tripId");
                  window.history.replaceState(null, "", url.toString());
                }
              }}
              onOpenWhere={() => setActiveModal("where")}
              onOpenWhen={() => setActiveModal("when")}
              onOpenWho={() => setActiveModal("who")}
              onOpenBudget={() => setActiveModal("budget")}
              className="static w-full md:w-full lg:w-full xl:w-full rounded-none border-l-0 shadow-none"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mindtrip Place Detail Slide Drawer (Same full height & 52%/54% width as /places tab, sliding over right side of ChatHeader) */}
      <AnimatePresence initial={false}>
        {activeDetailPlace && (
          <motion.div
            key="chat-detail-drawer"
            data-testid="chat-detail-drawer-host"
            initial={
              prefersReducedMotion ? false : { x: "100%", opacity: 0.96 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { x: "100%", opacity: 0.96 }
            }
            transition={drawerSlideTransition}
            className={cn(
              "absolute top-0 right-0 bottom-0 z-40 flex flex-col overflow-hidden bg-background select-none transition-[width,border-radius] duration-200 ease-out",
              isPlaceDetailExpanded
                ? "inset-0 w-full rounded-none border-l-0 shadow-none"
                : "w-full md:w-[50%] lg:w-[52%] xl:w-[54%] rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border/70 shadow-xl",
            )}
          >
            <PlaceDetailOverlay
              place={activeDetailPlace}
              isLoadingDetails={isLoadingPlaceDetail}
              isFavorite={isDetailFavorite}
              isAddedToTrip={isDetailAddedToTrip}
              onClose={handleClosePlaceDetail}
              onToggleFavorite={handleToggleDetailFavorite}
              onAddToTrip={handleAddDetailToTrip}
              isPanelCollapsed={isPlaceDetailExpanded}
              onTogglePanel={() =>
                setPlaceDetailState((prev) =>
                  prev && prev.chatId === chatId
                    ? { ...prev, isExpanded: !prev.isExpanded }
                    : prev,
                )
              }
              className="rounded-none border-l-0 shadow-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
