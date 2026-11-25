"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Briefcase,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Edit3,
  FileDown,
  FileText,
  Info,
  Lightbulb,
  Link2,
  Loader2,
  Luggage,
  Map as MapIcon,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Plus,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { useTripAiChatSessions } from "@/hooks/use-ai-chats";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { TripMembersDialog } from "./trip-members-dialog";
import { PrintItineraryDialog } from "./print-itinerary-dialog";
import { TripChecklistModal } from "./trip-checklist-modal";
import { TripActivityPollModal } from "./trip-activity-poll-modal";
import { TripSafetyGuideModal } from "./trip-safety-guide-modal";
import { TripReminderModal } from "./trip-reminder-modal";
import {
  MindtripItineraryView,
  type UpdateItemTimePayload,
} from "./mindtrip-itinerary-view";
import { useItineraryPlacePhotos } from "../hooks/use-itinerary-place-photos";
import { useTripIdeas } from "../hooks/use-trip-ideas";
import {
  createItineraryItem,
  isUuid,
} from "../services/trip-management-api";
import type { TripPlace } from "@/features/place-actions/types";
import { cloneTrip } from "../utils/clone-trip";
import type {
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse,
  TripResponse,
} from "../types";
import type { Place } from "@/features/places/types";
import {
  countTripDays,
  coverImageForTrip,
  displayTripTitle,
  formatShortRange,
  titleCaseDestination,
} from "../utils/format";
import {
  formatWhenSelection,
  parseFlexiblePreferenceFromNotes,
} from "../utils/date";
import { getDestinationCenter } from "../utils/map";

export { getDestinationCenter };

const MapVinaContainer = dynamic(
  () =>
    import("@/features/map/components/mapvina-container").then(
      (mod) => mod.MapVinaContainer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-border bg-muted/40 text-muted-foreground text-sm font-medium animate-pulse">
        <span>Loading map...</span>
      </div>
    ),
  },
);

type TripDetailRightPanel = "overview" | "itinerary";

function formatChatDate(dateStr?: string | null, locale: string = "vi"): string {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "";
  if (locale === "vi") {
    return `${parsed.getDate()} thg ${parsed.getMonth() + 1}, ${parsed.getFullYear()}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function TripDetailScreen({
  trip,
  itinerary,
  loading,
  error,
  submitting,
  chatText,
  onChatTextChange,
  onEditTrip,
  onAddItem,
  onEditItem,
  onUpdateItemTime,
  onDeleteItem,
  onReorderItems,
  onSortAllDaysByTime,
  onCreateTrip,
  onRequestDeleteTrip,
}: {
  trip: TripResponse | null;
  itinerary: ItineraryResponse | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  chatText: string;
  chatMessages: string[];
  onChatTextChange: (value: string) => void;
  onSendChat: () => void;
  onEditTrip: (trip: TripResponse) => void;
  onAddItem: (day: ItineraryDayResponse) => void;
  onEditItem: (item: ItineraryItemResponse) => void;
  onUpdateItemTime?: (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
    payload: UpdateItemTimePayload,
  ) => Promise<void> | void;
  onDeleteItem: (item: ItineraryItemResponse) => void;
  onMoveItem: (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
    direction: -1 | 1,
  ) => void;
  onReorderItems: (
    day: ItineraryDayResponse,
    orderedItemIds: string[],
    options?: { preserveTimes?: boolean },
  ) => Promise<void>;
  onSortAllDaysByTime?: () => Promise<void> | void;
  onCreateTrip: () => void;
  onRequestDeleteTrip?: (trip: TripResponse) => void;
}) {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [activePanel, setActivePanel] =
    React.useState<TripDetailRightPanel>("overview");
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(
    null,
  );
  const [fitBoundsTrigger, setFitBoundsTrigger] = React.useState<number>(0);

  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [coachIndex, setCoachIndex] = React.useState(0);
  const [showAllChats, setShowAllChats] = React.useState(false);

  const [copiedInviteLink, setCopiedInviteLink] = React.useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = React.useState(false);
  const [printDialogOpen, setPrintDialogOpen] = React.useState(false);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const [pollOpen, setPollOpen] = React.useState(false);
  const [safetyOpen, setSafetyOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [cloning, setCloning] = React.useState(false);

  // Shared batched place photos across left AI coach preview & right Mindtrip itinerary view
  const resolvedPhotoUrls = useItineraryPlacePhotos({
    tripId: trip?.id ?? null,
    destinationName: trip?.destinationName,
    itinerary,
  });

  // Live Trip Ideas saved from AI Chat carousels or Explore
  const {
    ideas: tripIdeas,
    photoUrls: ideaPhotoUrls,
    removeIdea,
  } = useTripIdeas({
    tripId: trip?.id ?? null,
  });

  const handlePromoteIdeaToDay = async (
    idea: TripPlace,
    day: ItineraryDayResponse,
  ) => {
    if (!trip) return;
    try {
      await createItineraryItem(trip.id, day.id, {
        placeId: isUuid(idea.placeRef) ? idea.placeRef : null,
        placeRef: idea.placeRef,
        type: "PLACE",
        title: idea.placeNameSnapshot,
        notes: idea.placeAddressSnapshot || undefined,
        expectedTripRevision: itinerary?.revision,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("tripsense:itinerary-updated", {
            detail: { tripId: trip.id },
          }),
        );
      }
      toast.success(
        t("trip.ideaAddedToDay", {
          name: idea.placeNameSnapshot,
          day: day.dayNumber,
        }),
      );
      router.refresh();
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    }
  };

  const handleRemoveIdea = async (idea: TripPlace) => {
    try {
      await removeIdea(idea.placeRef);
      toast.info(t("trip.ideaRemoved", { name: idea.placeNameSnapshot }));
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    }
  };

  // Strictly fetch AI Chat sessions linked to THIS tripId (never fuzzy-match other trips by destination name)
  const { data: linkedTripChats = [], isLoading: loadingAiChats } =
    useTripAiChatSessions(trip?.id);

  const tripChatSessions = React.useMemo(() => {
    if (!trip) return [];
    return linkedTripChats.filter((c) => c.tripId === trip.id);
  }, [linkedTripChats, trip]);

  const visibleChatSessions = React.useMemo(
    () => (showAllChats ? tripChatSessions : tripChatSessions.slice(0, 5)),
    [tripChatSessions, showAllChats],
  );

  const handleSendPromptToAi = (promptText: string) => {
    const text = promptText.trim();
    if (!text || !trip) return;

    if (typeof window !== "undefined") {
      sessionStorage.setItem("tripsense:initial-ai-prompt", text);
    }
    onChatTextChange("");

    const latestChat = tripChatSessions[0];
    if (latestChat) {
      router.push(`/ai-planner/${latestChat.id}?tripId=${trip.id}`);
    } else {
      router.push(`/ai-planner?tripId=${trip.id}`);
    }
  };

  const handleCloneTrip = async () => {
    if (!trip || cloning) return;
    try {
      setCloning(true);
      const copySuffix = locale === "vi" ? "(Bản sao)" : "(Copy)";
      const cloned = await cloneTrip(
        trip,
        {
          newName: `${trip.name} ${copySuffix}`,
        },
        itinerary,
      );
      toast.success(t("trip.cloneSuccess"));
      router.push(`/trips/${cloned.id}`);
    } catch (err) {
      toast.error(getSafeErrorMessage(err, t("trip.cloneFailed")));
    } finally {
      setCloning(false);
    }
  };

  const destination = trip ? titleCaseDestination(trip.destinationName) : "";
  const title = trip ? displayTripTitle(trip) : "";

  const allItineraryItems = React.useMemo(
    () => itinerary?.days?.flatMap((day) => day.items || []) ?? [],
    [itinerary],
  );

  const itineraryPlacesCount = allItineraryItems.length;

  const daysCount = trip
    ? itinerary?.days?.length || countTripDays(trip)
    : 1;

  // Cohesive duration / date range label for metadata segmented pill
  const durationBadgeLabel = React.useMemo(() => {
    if (!trip) return "";
    const flexInfo = parseFlexiblePreferenceFromNotes(trip.notes);
    if (flexInfo) {
      return formatWhenSelection({
        type: "flexible",
        durationDays: flexInfo.durationDays,
        flexibleMonths: flexInfo.flexibleMonths,
        locale,
      });
    }
    if (trip.startDate && trip.endDate) {
      return formatShortRange(trip.startDate, trip.endDate);
    }
    return `${daysCount} ${t("trip.daysCount")}`;
  }, [trip, locale, daysCount, t]);

  // Preview thumbnails for the borderless Mindtrip AI coach section
  const coachPreviewThumbs = React.useMemo(() => {
    const thumbs: Array<{ id: string; url: string; title: string }> = [];
    for (const item of allItineraryItems) {
      const url = resolvedPhotoUrls[item.id];
      if (url && !thumbs.some((entry) => entry.url === url)) {
        thumbs.push({ id: item.id, url, title: item.title });
      }
      if (thumbs.length >= 3) break;
    }
    if (thumbs.length === 0 && trip) {
      thumbs.push({
        id: "trip-cover",
        url: coverImageForTrip(trip),
        title: destination || title,
      });
    }
    return thumbs;
  }, [allItineraryItems, resolvedPhotoUrls, trip, destination, title]);

  // 3 editorial AI coach cards matching Reference Image 2 (< 1 of 3 >)
  const coachSlides = React.useMemo(() => {
    const topNames = allItineraryItems
      .slice(0, 3)
      .map((item) => item.title)
      .filter(Boolean);

    const summaryHeadline =
      topNames.length >= 2
        ? t("trip.aiCoachSummaryWithPlaces", {
            destination,
            places: topNames.join(", "),
          })
        : t("trip.aiCoachSummaryEmpty", { destination });

    return [
      {
        headline: summaryHeadline,
        ctaLabel: t("trip.shapeTheDays"),
        onCta: () => {
          if (itineraryPlacesCount > 0) {
            setActivePanel("itinerary");
          } else {
            handleSendPromptToAi(
              locale === "vi"
                ? `Lên lịch trình chi tiết ${daysCount} ngày tại ${destination} kèm khung giờ gợi ý`
                : `Build a detailed ${daysCount}-day itinerary for ${destination} with suggested times`,
            );
          }
        },
      },
      {
        headline: t("trip.aiCoachFoodHeadline", { destination }),
        ctaLabel: t("trip.showFoodIdeas"),
        onCta: () =>
          handleSendPromptToAi(
            locale === "vi"
              ? `Gợi ý các quán ăn ngon, cà phê đẹp và món đặc sản nổi bật ở ${destination}`
              : `Suggest top local restaurants, cafés, and must-try dishes in ${destination}`,
          ),
      },
      {
        headline: t("trip.aiCoachOptimizeHeadline", { destination }),
        ctaLabel: t("trip.optimizeSchedule"),
        onCta: () =>
          handleSendPromptToAi(
            locale === "vi"
              ? `Tối ưu thứ tự thời gian và cung đường di chuyển cho lịch trình ${destination} của tôi`
              : `Optimize the timing and route order for my ${destination} itinerary`,
          ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItineraryItems, destination, itineraryPlacesCount, daysCount, locale, t]);

  const activeCoachSlide = coachSlides[coachIndex % coachSlides.length];

  const mapPlaces: Place[] = React.useMemo(() => {
    if (!trip) return [];
    const places: Place[] = [];
    const destCenter = getDestinationCenter(trip.destinationName);

    if (itinerary?.days) {
      for (const day of itinerary.days) {
        for (const item of day.items) {
          const lat = item.latSnapshot;
          const lng = item.lngSnapshot;

          // Only add places with verified coordinates; never fabricate fake ratings
          if (lat != null && lng != null) {
            places.push({
              id: item.id,
              name: item.title,
              address: item.placeNameSnapshot || destination,
              location: { lat, lng },
              categories: [item.type],
              photos: resolvedPhotoUrls[item.id]
                ? [resolvedPhotoUrls[item.id]]
                : [],
            });
          }
        }
      }
    }

    if (places.length === 0) {
      places.push({
        id: "destination-center",
        name: destination,
        address: destination,
        location: { lat: destCenter[1], lng: destCenter[0] },
        categories: ["ATTRACTION"],
        photos: [],
      });
    }

    return places;
  }, [trip, itinerary, destination, resolvedPhotoUrls]);

  const copyInviteLink = async () => {
    const inviteLink =
      typeof window !== "undefined" ? window.location.href : "";
    if (!inviteLink) return;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
    }
    setCopiedInviteLink(true);
    toast.success(t("trip.copiedInviteLink"));
    window.setTimeout(() => setCopiedInviteLink(false), 2000);
  };

  if (loading) {
    return <LoadingState className="min-h-screen" text={t("common.loading")} />;
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <EmptyState
          icon={Briefcase}
          title={t("trip.tripNotFound")}
          description={error || t("trip.tripNotFoundDesc")}
          action={<Button onClick={onCreateTrip}>{t("trip.newTrip")}</Button>}
        />
      </div>
    );
  }

  const centerCoordinates = getDestinationCenter(trip.destinationName);

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* Minimal Mindtrip Top Header (no duplicated trip title) */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between bg-background/95 backdrop-blur-md px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-9 rounded-full border border-border/80 bg-background hover:bg-muted text-foreground"
          >
            <Link href="/trips" aria-label={t("trip.back")}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full px-3.5 text-xs font-semibold gap-1.5 border-border/80 bg-background hover:bg-muted cursor-pointer"
            onClick={() => setMembersDialogOpen(true)}
          >
            <Users className="size-3.5 text-primary" />
            <span>{t("trip.invite")}</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full border-border/80 bg-background hover:bg-muted cursor-pointer hidden sm:inline-flex"
            onClick={() => setPrintDialogOpen(true)}
            title={t("trip.export")}
            aria-label={t("trip.export")}
          >
            <FileDown className="size-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full border-border/80 bg-background hover:bg-muted cursor-pointer"
            title={t("trip.editTrip")}
            aria-label={t("trip.editTrip")}
            onClick={() => onEditTrip(trip)}
          >
            <Edit3 className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full border-border/80 bg-background hover:bg-muted cursor-pointer"
                aria-label={t("common.actions")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-2xl p-2"
              align="end"
              sideOffset={8}
            >
              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer sm:hidden"
                onSelect={() => setPrintDialogOpen(true)}
              >
                <FileDown className="size-4" />
                {t("trip.export")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={copyInviteLink}
              >
                {copiedInviteLink ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <Link2 className="size-4" />
                )}
                {copiedInviteLink
                  ? t("trip.copiedInviteLink")
                  : t("trip.copyInviteLink")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={() => setSafetyOpen(true)}
              >
                <Shield className="size-4 text-emerald-600" />
                {t("trip.safetyGuide")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={() => setReminderOpen(true)}
              >
                <TripReminderIcon className="size-4 text-amber-600" />
                {t("trip.tripReminders")}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={handleCloneTrip}
                disabled={cloning}
              >
                <Copy className="size-4" />
                {cloning ? t("trip.cloning") : t("trip.cloneTrip")}
              </DropdownMenuItem>

              {onRequestDeleteTrip && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer text-destructive focus:text-destructive"
                    onSelect={() => onRequestDeleteTrip(trip)}
                    disabled={submitting}
                  >
                    <Trash2 className="size-4" />
                    {t("trip.deleteTrip")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {error && <ErrorState className="mx-6 mb-2" message={error} />}

      {/* Main 2-Column Mindtrip Workspace */}
      <main className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Editorial Overview, Segmented Metadata Bar, Borderless AI Coach, Clean Chats & Spacious Composer */}
        <section
          className={cn(
            "lg:col-span-5 xl:col-span-5 flex flex-col h-full min-h-0 overflow-hidden",
            activePanel === "itinerary" && "lg:border-r lg:border-border/60",
          )}
        >
          <div className="flex-1 overflow-y-auto px-5 sm:px-7 lg:px-8 pt-2 pb-6 space-y-7">
            {/* Title & Cohesive Segmented Metadata Bar */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
              </h1>

              <div
                role="group"
                aria-label={t("trip.tripOverviewMetadata")}
                className="mt-3 inline-flex flex-wrap items-center rounded-full border border-border/80 bg-card divide-x divide-border/70 text-xs shadow-2xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onEditTrip(trip)}
                  className="px-3 py-1.5 font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  {destination}
                </button>
                <button
                  type="button"
                  onClick={() => onEditTrip(trip)}
                  className="px-3 py-1.5 font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  {durationBadgeLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onEditTrip(trip)}
                  className={cn(
                    "px-3 py-1.5 hover:bg-muted/60 transition-colors cursor-pointer",
                    trip.travelerCount
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {trip.travelerCount
                    ? `${trip.travelerCount} ${t("trip.travelers")}`
                    : t("trip.whoPlaceholder")}
                </button>
                <button
                  type="button"
                  onClick={() => onEditTrip(trip)}
                  className={cn(
                    "px-3 py-1.5 hover:bg-muted/60 transition-colors cursor-pointer",
                    trip.budgetAmount
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {trip.budgetAmount
                    ? `${trip.budgetAmount.toLocaleString()} ${trip.budgetCurrency || "VND"}`
                    : t("trip.budget")}
                </button>
              </div>
            </div>

            {/* Borderless Editorial Mindtrip AI Coach */}
            {!bannerDismissed && (
              <div className="space-y-3.5 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-background">
                    <Sparkles className="size-3.5" />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                    <button
                      type="button"
                      onClick={() =>
                        setCoachIndex(
                          (prev) =>
                            (prev - 1 + coachSlides.length) %
                            coachSlides.length,
                        )
                      }
                      aria-label={t("common.previous")}
                      className="size-6 rounded-full flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span>
                      {t("trip.coachStepCounter", {
                        current: (coachIndex % coachSlides.length) + 1,
                        total: coachSlides.length,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCoachIndex((prev) => (prev + 1) % coachSlides.length)
                      }
                      aria-label={t("common.next")}
                      className="size-6 rounded-full flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-bold leading-snug tracking-tight text-foreground">
                  {activeCoachSlide.headline}
                </h2>

                {coachPreviewThumbs.length > 0 && (
                  <div className="flex items-center gap-2">
                    {coachPreviewThumbs.map((thumb) => (
                      <button
                        key={thumb.id}
                        type="button"
                        onClick={() => setActivePanel("itinerary")}
                        className="size-14 rounded-2xl overflow-hidden border border-border/60 bg-muted shrink-0 cursor-pointer group"
                        title={thumb.title}
                      >
                        <img
                          src={thumb.url}
                          alt={thumb.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={activeCoachSlide.onCta}
                    className="rounded-full bg-secondary hover:bg-secondary/80 px-4 py-2 text-xs font-semibold text-secondary-foreground transition-colors cursor-pointer"
                  >
                    {activeCoachSlide.ctaLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="rounded-full border border-border/80 bg-background hover:bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors cursor-pointer"
                  >
                    {t("trip.dismiss")}
                  </button>
                </div>
              </div>
            )}

            {/* Clean Clickable Chats Section (opens AI Planner directly, no raw markdown preview clutter) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  {t("trip.chats")}
                  <span className="font-normal text-muted-foreground ml-1.5">
                    {tripChatSessions.length}
                  </span>
                </h3>
                {tripChatSessions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllChats((prev) => !prev)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showAllChats
                      ? t("trip.showLessChats")
                      : t("trip.showAllChats", {
                          count: tripChatSessions.length,
                        })}
                  </button>
                )}
              </div>

              {loadingAiChats ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : tripChatSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-5 text-center space-y-1.5">
                  <MessageSquare className="size-5 mx-auto text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">
                    {t("trip.noChatsYet")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("trip.noChatsDesc")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleChatSessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/ai-planner/${session.id}?tripId=${trip.id}`}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5 transition-all hover:bg-accent/40 hover:border-border cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {session.title || t("trip.untitledChat")}
                        </h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatChatDate(
                            session.updatedAt || session.createdAt,
                            locale,
                          )}
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Spacious Mindtrip 2-Row Bottom Composer */}
          <div className="shrink-0 bg-background/95 backdrop-blur-md px-5 sm:px-7 lg:px-8 pb-5 pt-2">
            <div className="rounded-2xl border border-border/90 bg-card px-4 py-3 shadow-xs focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-ring/20 transition-all">
              <input
                type="text"
                value={chatText}
                onChange={(e) => onChatTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPromptToAi(chatText);
                  }
                }}
                placeholder={t("trip.chatPlaceholder")}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => itinerary?.days[0] && onAddItem(itinerary.days[0])}
                  disabled={!itinerary?.days[0]}
                  className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
                  title={t("trip.addSpot")}
                  aria-label={t("trip.addSpot")}
                >
                  <Plus className="size-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPromptToAi(
                        chatText.trim() ||
                          (locale === "vi"
                            ? `Hỗ trợ tôi lên kế hoạch cho ${title}`
                            : `Help me plan ${title}`),
                      )
                    }
                    className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title={t("trip.voiceInput")}
                    aria-label={t("trip.voiceInput")}
                  >
                    <Mic className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendPromptToAi(chatText)}
                    disabled={!chatText.trim()}
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
                      chatText.trim()
                        ? "bg-foreground text-background hover:bg-foreground/90 shadow-xs"
                        : "bg-muted text-muted-foreground cursor-not-allowed",
                    )}
                    aria-label={t("common.send")}
                  >
                    <Send className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Overview (2x3 Action Tiles + Clean Map) OR Full Mindtrip Itinerary Pane */}
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col h-full min-h-0 overflow-hidden">
          {activePanel === "overview" ? (
            <div className="flex flex-col h-full min-h-0 px-5 sm:px-6 lg:pr-8 pt-2 pb-5 gap-4 overflow-hidden">
              {/* 2x3 Mindtrip Action Tiles */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <ActionTile
                  icon={Lightbulb}
                  label={t("trip.ideas")}
                  badge={tripIdeas.length > 0 ? `${tripIdeas.length}` : undefined}
                  onClick={() => {
                    if (tripIdeas.length > 0) {
                      setActivePanel("itinerary");
                    } else {
                      setPollOpen(true);
                    }
                  }}
                />
                <ActionTile
                  icon={Compass}
                  label={t("trip.itinerary")}
                  badge={
                    itineraryPlacesCount > 0
                      ? `${itineraryPlacesCount}`
                      : undefined
                  }
                  onClick={() => setActivePanel("itinerary")}
                />
                <ActionTile
                  icon={Luggage}
                  label={t("trip.bookings")}
                  onClick={() => setChecklistOpen(true)}
                />
                <ActionTile
                  icon={FileText}
                  label={t("trip.media")}
                  onClick={() => onEditTrip(trip)}
                />
                <ActionTile
                  icon={Info}
                  label={t("trip.preferences")}
                  badge="1"
                  onClick={() => onEditTrip(trip)}
                />
                <ActionTile
                  icon={Calendar}
                  label={t("trip.calendar")}
                  badge={
                    itineraryPlacesCount > 0
                      ? `${itineraryPlacesCount}`
                      : undefined
                  }
                  href="/calendar"
                />
              </div>

              {/* Clean Interactive Map */}
              <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-3xl border border-border/70 bg-muted shadow-xs">
                <MapVinaContainer
                  places={mapPlaces}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={setSelectedPlaceId}
                  center={centerCoordinates}
                  zoom={mapPlaces.length > 1 ? 12 : 13}
                  fitBoundsTrigger={fitBoundsTrigger}
                  className="h-full w-full"
                />
              </div>
            </div>
          ) : (
            /* Full Right-Pane Mindtrip Itinerary View (matching Reference Image 3) */
            <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
              {/* Itinerary Pane Top Utility Bar */}
              <div className="flex items-center justify-between px-5 sm:px-7 pt-2 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePanel("overview")}
                    aria-label={t("common.close")}
                    title={t("common.close")}
                    className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePanel("overview");
                      setFitBoundsTrigger((prev) => prev + 1);
                    }}
                    className="inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title={t("aiPlanner.mapToggle")}
                  >
                    <MapIcon className="size-3.5" />
                    <span>{t("trip.viewMap")}</span>
                  </button>
                </div>

                {itinerary?.days[0] && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddItem(itinerary.days[0])}
                    className="h-8 rounded-full px-3 text-xs font-semibold gap-1.5 border-border/80 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>{t("trip.addSpot")}</span>
                  </Button>
                )}
              </div>

              {/* Scrollable Mindtrip Itinerary Content */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 pb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-5">
                  {t("trip.itinerary")}
                </h2>

                <MindtripItineraryView
                  trip={trip}
                  itinerary={itinerary}
                  loading={loading}
                  submitting={submitting}
                  photoUrls={resolvedPhotoUrls}
                  selectedItemId={selectedPlaceId}
                  showIdeasSection={true}
                  showInspirationBanner={itineraryPlacesCount === 0}
                  ideas={tripIdeas}
                  ideaPhotoUrls={ideaPhotoUrls}
                  onPromoteIdeaToDay={handlePromoteIdeaToDay}
                  onRemoveIdea={handleRemoveIdea}
                  onAddItem={onAddItem}
                  onAddIdea={() => setPollOpen(true)}
                  onEditItem={onEditItem}
                  onUpdateItemTime={onUpdateItemTime}
                  onReorderItems={onReorderItems}
                  onSortAllDaysByTime={onSortAllDaysByTime}
                  onDeleteItem={(_day, item) => onDeleteItem(item)}
                  onSelectItem={(item) => setSelectedPlaceId(item.id)}
                  onOpenMap={(focusItemId) => {
                    if (focusItemId) {
                      setSelectedPlaceId(focusItemId);
                    }
                    setActivePanel("overview");
                    setFitBoundsTrigger((prev) => prev + 1);
                  }}
                  onAskAiForDay={(day) =>
                    handleSendPromptToAi(
                      locale === "vi"
                        ? `Gợi ý lịch trình chi tiết cho Ngày ${day.dayNumber} tại ${destination}`
                        : `Suggest detailed places and schedule for Day ${day.dayNumber} in ${destination}`,
                    )
                  }
                />
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Auxiliary Modals */}
      <TripMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        tripId={trip.id}
        tripName={title}
      />

      <PrintItineraryDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        trip={trip}
        itinerary={itinerary}
      />

      <TripChecklistModal
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        tripId={trip.id}
        tripName={title}
      />

      <TripActivityPollModal
        open={pollOpen}
        onOpenChange={setPollOpen}
        tripId={trip.id}
        tripName={title}
        itinerary={itinerary}
        onPinToDay={(dayId) => {
          const day = itinerary?.days.find((d) => d.id === dayId);
          if (day) {
            onAddItem(day);
          }
        }}
      />

      <TripSafetyGuideModal
        open={safetyOpen}
        onOpenChange={setSafetyOpen}
        destination={destination}
      />

      <TripReminderModal
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        tripId={trip.id}
        tripName={title}
      />
    </div>
  );
}

function TripReminderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function ActionTile({
  icon: Icon,
  label,
  badge,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex h-12 items-center justify-between rounded-2xl border border-border/80 bg-card px-4 text-sm font-semibold shadow-2xs transition-all duration-200 hover:bg-accent/50 hover:border-border cursor-pointer">
      <span className="flex items-center gap-3 text-foreground min-w-0">
        <Icon className="size-4 text-foreground/80 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span className="flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground shrink-0 tabular-nums">
          {badge}
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button
      type="button"
      className="text-left w-full cursor-pointer"
      onClick={onClick}
    >
      {content}
    </button>
  );
}
