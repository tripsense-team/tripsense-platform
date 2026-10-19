"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useArtifact } from "@/hooks/use-artifact";
import { useAuthStore, AuthModal } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { ChatHeader } from "./chat-header";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { TripDetailPanel } from "./trip-detail-panel";
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
  getTrip,
  updateTrip,
} from "@/features/trip-management/services/trip-management-api";
import {
  resolveFlexibleDates,
  isoDateFromToday,
  parseFlexiblePreferenceFromNotes,
} from "@/features/trip-management/utils/date";
import type { TripResponse } from "@/features/trip-management/types";
import {
  getChatTripContext,
  getPlanningBrief,
  linkChatToTrip,
  patchPlanningBrief,
} from "@/features/ai-trip-commit/services/ai-trip-commit-api";
import type { TripPlanningBrief } from "@/features/ai-trip-commit/types";
import { isGenericChatTitle } from "@/hooks/use-ai-chats";
import { aiChatQueryKeys, getQueryClient } from "@/lib/react-query";

export function ChatShell() {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const searchParams = useSearchParams();
  const tripIdParam = searchParams?.get("tripId");

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
    isBackendReady,
    isHistoryLoading,
  } = useActiveChat();

  const toggleDrawer = useAiDrawerStore((state) => state.toggleDrawer);
  const { artifact } = useArtifact();

  // Modals state
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active Trip & Side Panel state
  const [activeTrip, setActiveTrip] = useState<TripResponse | null>(null);
  const [isTripDetailOpen, setIsTripDetailOpen] = useState(false);
  const [isTripPanelCollapsed, setIsTripPanelCollapsed] = useState(false);
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
  const [planningBriefVersion, setPlanningBriefVersion] = useState<number | null>(null);
  const [planningBriefStatus, setPlanningBriefStatus] = useState<string | null>(null);

  // Extract AI-generated themes for each day (e.g. Day 1: "Biển Mỹ Khê & Bán Đảo Sơn Trà")
  const dayThemes = useMemo(() => {
    const map: Record<number, string> = {};
    for (const m of messages) {
      if (m.role === "assistant") {
        if (Array.isArray(m.parts)) {
          for (const p of m.parts) {
            const res =
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
            if (p && typeof p === "object" && (p as any).type === "text" && typeof (p as any).text === "string") {
              const text = (p as any).text;
              const matches = text.matchAll(/(?:Ngày|Day)\s*(\d+)\s*[:–-]\s*([^\n\r#*]+)/gi);
              for (const match of matches) {
                const dayNum = parseInt(match[1], 10);
                const theme = match[2].trim().replace(/^[*_~]+|[*_~]+$/g, "");
                if (dayNum && theme && !map[dayNum]) {
                  map[dayNum] = theme;
                }
              }
            }
          }
        }
        if ("content" in m && typeof (m as any).content === "string") {
          const text = (m as any).content;
          const matches = text.matchAll(/(?:Ngày|Day)\s*(\d+)\s*[:–-]\s*([^\n\r#*]+)/gi);
          for (const match of matches) {
            const dayNum = parseInt(match[1], 10);
            const theme = match[2].trim().replace(/^[*_~]+|[*_~]+$/g, "");
            if (dayNum && theme && !map[dayNum]) {
              map[dayNum] = theme;
            }
          }
        }
      }
    }
    return map;
  }, [messages]);

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
          setIsTripDetailOpen(true);
        }
      })
      .catch((err) => {
        console.error("Failed to load trip from query param:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [tripIdParam, activeTrip?.id]);

  // Listen for open-trip-detail event from chat messages or intake card
  useEffect(() => {
    const handleOpenDetail = () => setIsTripDetailOpen(true);
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
        setIsTripDetailOpen(true);
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
  }, [chatId, isAuthenticated, tripIdParam]);

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
                onClick: () => setIsTripDetailOpen(true),
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
      setIsTripDetailOpen(true);
      setIsTripPanelCollapsed(false);
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
    [chatId, locale]
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

      // Hidden directive for AI: instructs Gemini to immediately search places and generate the complete multi-day proposal
      const travelerDirective = travelers ? `, ${travelers} khách` : "";
      const hiddenDirective = `<!-- ai-directive: Người dùng vừa tạo chuyến đi "${newTrip.name}" đến ${dest} (${durationDays} ngày${travelerDirective}). Hãy lập tức dùng searchPlaces tìm kiếm các địa điểm thực tế uy tín tại ${dest} và gọi createTripProposal để sinh lịch trình hoàn chỉnh chi tiết cho tất cả ${durationDays} ngày. Không hỏi lại các thông tin cơ bản. -->`;

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

  // Reactive Auto-Update: Whenever AI finishes streaming or generates itinerary, trigger real-time refresh in TripDetailPanel
  const wasStreamingTrackerRef = useRef(false);
  useEffect(() => {
    if (status === "streaming") {
      wasStreamingTrackerRef.current = true;
    } else if (status === "ready" && wasStreamingTrackerRef.current) {
      wasStreamingTrackerRef.current = false;
      if (activeTrip?.id) {
        // 1. Immediate trigger
        window.dispatchEvent(
          new CustomEvent("tripsense:itinerary-updated", {
            detail: { tripId: activeTrip.id },
          }),
        );
        // 2. Delayed triggers (500ms and 1500ms) to ensure backend database commits have completed
        const timer1 = setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("tripsense:itinerary-updated", {
              detail: { tripId: activeTrip.id },
            }),
          );
        }, 500);

        const timer2 = setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("tripsense:itinerary-updated", {
              detail: { tripId: activeTrip.id },
            }),
          );
        }, 1500);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }
  }, [status, activeTrip?.id]);

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

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Mindtrip-Style Chat Header (Always full-width across the top, never shrinks when TripDetailPanel opens) */}
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
        onToggleTripDetail={() => setIsTripDetailOpen((prev) => !prev)}
      />

      {/* Modals for Where, When, Who, Budget */}
      <WhereModal
        isOpen={activeModal === "where"}
        onClose={() => setActiveModal(null)}
        initialLocation={tripPreferences.where?.location}
        initialRoadTrip={tripPreferences.where?.isRoadTrip}
        onSave={(data) => {
          setTripPreferences((prev) => ({ ...prev, where: data }));
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
              sendMessage={sendMessage}
              selectedModelId={currentModelId}
              onModelChange={setCurrentModelId}
              status={status}
              stop={stop}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          </div>
        </div>

        {/* Mindtrip Trip Detail Panel (Mounted side-by-side with messages below the full-width header) */}
        {activeTrip && isTripDetailOpen && (
          <TripDetailPanel
            trip={activeTrip}
            dayThemes={dayThemes}
            onClose={() => setIsTripDetailOpen(false)}
            isCollapsed={isTripPanelCollapsed}
            onToggleCollapse={() =>
              setIsTripPanelCollapsed((prev) => !prev)
            }
            onTripUpdated={(updatedTrip) => {
              pendingTripTitleUpdateIdRef.current = null;
              setActiveTrip(updatedTrip);
            }}
            onTripDeleted={() => {
              setActiveTrip(null);
              setIsTripDetailOpen(false);
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
          />
        )}
      </div>
    </div>
  );
}
