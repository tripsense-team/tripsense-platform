"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Edit3,
  ExternalLink,
  FileDown,
  FileText,
  Info,
  Lightbulb,
  Link2,
  Loader2,
  Luggage,
  MapPin,
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
import { useAiChatSessions, fetchChatMessagesQueryFn, type ChatSession } from "@/hooks/use-ai-chats";
import type { ChatMessage } from "@/lib/types";
import { TripMembersDialog } from "./trip-members-dialog";
import { PrintItineraryDialog } from "./print-itinerary-dialog";
import { TripChecklistModal } from "./trip-checklist-modal";
import { TripActivityPollModal } from "./trip-activity-poll-modal";
import { TripSafetyGuideModal } from "./trip-safety-guide-modal";
import { TripReminderModal } from "./trip-reminder-modal";
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
  displayTripTitle,
  formatDate,
  formatShortRange,
  itemTypeLabel,
  titleCaseDestination,
} from "../utils/format";
import { formatDisplayTimeRange } from "../utils/time";

const MapVinaContainer = dynamic(
  () =>
    import("@/features/map/components/mapvina-container").then(
      (mod) => mod.MapVinaContainer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border bg-muted/40 text-muted-foreground text-sm font-medium animate-pulse">
        <span>Loading map...</span>
      </div>
    ),
  },
);

type TripDetailPanel = "overview" | "itinerary";

export function getDestinationCenter(destination: string): [number, number] {
  const norm = (destination || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Vietnam locations
  if (norm.includes("my tho") || norm.includes("tien giang")) return [106.3667, 10.3667];
  if (norm.includes("can tho")) return [105.7844, 10.0452];
  if (norm.includes("ben tre")) return [106.3756, 10.2415];
  if (norm.includes("da nang")) return [108.2022, 16.0544];
  if (norm.includes("ha noi") || norm.includes("hanoi")) return [105.8342, 21.0278];
  if (norm.includes("ho chi minh") || norm.includes("sai gon") || norm.includes("hcm")) return [106.6297, 10.8231];
  if (norm.includes("hoi an")) return [108.3262, 15.8801];
  if (norm.includes("hue")) return [107.5905, 16.4637];
  if (norm.includes("nha trang")) return [109.1967, 12.2388];
  if (norm.includes("da lat") || norm.includes("dalat")) return [108.4583, 11.9404];
  if (norm.includes("phu quoc")) return [103.963, 10.2899];
  if (norm.includes("quy nhon")) return [109.2197, 13.782];
  if (norm.includes("vung tau")) return [107.0843, 10.346];
  if (norm.includes("ha giang")) return [104.9833, 22.8233];
  if (norm.includes("sapa")) return [103.8438, 22.3364];
  if (norm.includes("ninh binh")) return [105.9745, 20.2506];
  if (norm.includes("phan thiet") || norm.includes("mui ne")) return [108.1001, 10.9333];

  // International locations
  if (norm.includes("tokyo")) return [139.6917, 35.6895];
  if (norm.includes("kyoto")) return [135.7681, 35.0116];
  if (norm.includes("bangkok")) return [100.5018, 13.7563];
  if (norm.includes("singapore")) return [103.8198, 1.3521];
  if (norm.includes("seoul")) return [126.978, 37.5665];

  return [108.2022, 16.0544];
}

function extractMessageText(msg: ChatMessage): string {
  if (!msg.parts) return "";
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p && (p.type === "text" || typeof p.text === "string"))
      .map((p: any) => p.text || "")
      .join("\n")
      .trim();
  }
  return "";
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
  onDeleteItem,
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
  onDeleteItem: (item: ItineraryItemResponse) => void;
  onMoveItem: (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
    direction: -1 | 1,
  ) => void;
  onReorderItems: (
    day: ItineraryDayResponse,
    orderedItemIds: string[],
  ) => Promise<void>;
  onCreateTrip: () => void;
  onRequestDeleteTrip?: (trip: TripResponse) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [activePanel, setActivePanel] = React.useState<TripDetailPanel>("overview");
  const [selectedDayNumber, setSelectedDayNumber] = React.useState<number | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [fitBoundsTrigger, setFitBoundsTrigger] = React.useState<number>(0);

  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = React.useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = React.useState(false);
  const [printDialogOpen, setPrintDialogOpen] = React.useState(false);
  const [checklistOpen, setChecklistOpen] = React.useState(false);
  const [pollOpen, setPollOpen] = React.useState(false);
  const [safetyOpen, setSafetyOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [cloning, setCloning] = React.useState(false);

  // Real Chat Sessions from AI Service
  const { data: allAiChats = [], isLoading: loadingAiChats } = useAiChatSessions();

  const tripChatSessions = React.useMemo(() => {
    if (!trip) return [];
    // 1. Direct match by tripId
    const directMatches = allAiChats.filter((c) => c.tripId === trip.id);
    if (directMatches.length > 0) return directMatches;

    // 2. Soft match by destination or trip title
    const dest = trip.destinationName.toLowerCase();
    const tripName = trip.name.toLowerCase();
    return allAiChats.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(dest)) ||
        (c.title && c.title.toLowerCase().includes(tripName)),
    );
  }, [allAiChats, trip]);

  const [selectedChatSessionId, setSelectedChatSessionId] = React.useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = React.useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  // Auto-select first chat session if available
  React.useEffect(() => {
    if (tripChatSessions.length > 0 && !selectedChatSessionId) {
      setSelectedChatSessionId(tripChatSessions[0].id);
    }
  }, [tripChatSessions, selectedChatSessionId]);

  // Load real messages on chat selection
  React.useEffect(() => {
    if (!selectedChatSessionId) {
      setSessionMessages([]);
      return;
    }
    let isMounted = true;
    setLoadingMessages(true);
    fetchChatMessagesQueryFn(selectedChatSessionId)
      .then((msgs) => {
        if (isMounted) setSessionMessages(msgs);
      })
      .catch((err) => {
        console.warn("Failed to load chat messages:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingMessages(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedChatSessionId]);

  const handleSendPromptToAi = (promptText: string) => {
    const text = promptText.trim();
    if (!text || !trip) return;

    if (typeof window !== "undefined") {
      sessionStorage.setItem("tripsense:initial-ai-prompt", text);
    }
    onChatTextChange("");

    if (selectedChatSessionId) {
      router.push(`/ai-planner/${selectedChatSessionId}?tripId=${trip.id}`);
    } else {
      router.push(`/ai-planner?tripId=${trip.id}`);
    }
  };

  const handleCloneTrip = async () => {
    if (!trip || cloning) return;
    try {
      setCloning(true);
      const cloned = await cloneTrip(
        trip,
        {
          newName: `${trip.name} (Bản sao)`,
        },
        itinerary,
      );
      router.push(`/trips/${cloned.id}`);
    } catch {
      // Ignore
    } finally {
      setCloning(false);
    }
  };

  const destination = trip ? titleCaseDestination(trip.destinationName) : "";
  const title = trip ? displayTripTitle(trip) : "";

  const mapPlaces: Place[] = React.useMemo(() => {
    if (!trip) return [];
    const places: Place[] = [];
    const destCenter = getDestinationCenter(trip.destinationName);

    if (itinerary?.days) {
      for (const day of itinerary.days) {
        if (selectedDayNumber != null && day.dayNumber !== selectedDayNumber) {
          continue;
        }

        for (const item of day.items) {
          const lat = item.latSnapshot;
          const lng = item.lngSnapshot;

          // Only add places with verified coordinates to avoid fake pins
          if (lat != null && lng != null) {
            places.push({
              id: item.id,
              name: item.title,
              address: item.placeNameSnapshot || destination,
              location: { lat, lng },
              categories: [item.type],
              rating: 4.8,
              userRatingCount: 120,
              photos: [],
            });
          }
        }
      }
    }

    // Fallback marker for destination if no itinerary item has coordinates yet
    if (places.length === 0) {
      places.push({
        id: "destination-center",
        name: destination,
        address: destination,
        location: { lat: destCenter[1], lng: destCenter[0] },
        categories: ["ATTRACTION"],
        rating: 5.0,
        userRatingCount: 1,
        photos: [],
      });
    }

    return places;
  }, [trip, itinerary, selectedDayNumber, destination]);

  const itineraryPlacesCount = React.useMemo(() => {
    return (
      itinerary?.days.reduce((total, d) => total + (d.items?.length || 0), 0) || 0
    );
  }, [itinerary]);

  const copyInviteLink = async () => {
    const inviteLink =
      typeof window !== "undefined" ? window.location.href : "";
    if (!inviteLink) return;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(inviteLink);
    }
    setCopiedInviteLink(true);
    window.setTimeout(() => setCopiedInviteLink(false), 2000);
  };

  if (loading) {
    return (
      <LoadingState
        className="min-h-screen"
        text={t("common.loading", { defaultValue: "Loading..." })}
      />
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <EmptyState
          icon={Briefcase}
          title={t("trip.tripNotFound", { defaultValue: "Trip not found" })}
          description={
            error ||
            t("trip.tripNotFoundDesc", {
              defaultValue: "Create or select a trip to continue.",
            })
          }
          action={
            <Button onClick={onCreateTrip}>
              {t("trip.newTrip", { defaultValue: "New trip" })}
            </Button>
          }
        />
      </div>
    );
  }

  const centerCoordinates = getDestinationCenter(trip.destinationName);

  return (
    <div className="h-full bg-background flex flex-col overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-border/80 hover:bg-muted"
          >
            <Link href="/trips" aria-label={t("trip.back", { defaultValue: "Back to trips" })}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-semibold gap-1.5 border-border shadow-2xs hover:bg-accent cursor-pointer"
            onClick={() => setMembersDialogOpen(true)}
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            <span>{t("trip.invite", { defaultValue: "Invite" })}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-semibold gap-1.5 border-border shadow-2xs hover:bg-accent cursor-pointer hidden sm:flex"
            onClick={() => setPrintDialogOpen(true)}
          >
            <FileDown className="h-3.5 w-3.5 text-primary" />
            <span>{t("trip.export", { defaultValue: "Export" })}</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border hover:bg-accent cursor-pointer"
            aria-label="Edit trip"
            onClick={() => onEditTrip(trip)}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-border hover:bg-accent cursor-pointer"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-2xl p-2"
              align="end"
              sideOffset={8}
            >
              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={copyInviteLink}
              >
                {copiedInviteLink ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {copiedInviteLink
                  ? t("trip.copiedInviteLink", { defaultValue: "Copied invite link" })
                  : t("trip.copyInviteLink", { defaultValue: "Copy invite link" })}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={() => setSafetyOpen(true)}
              >
                <Shield className="h-4 w-4 text-emerald-600" />
                {t("trip.safetyGuide", { defaultValue: "Safety & Emergency Guide" })}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={() => setReminderOpen(true)}
              >
                <TripReminderIcon className="h-4 w-4 text-amber-600" />
                {t("trip.tripReminders", { defaultValue: "Trip Reminders" })}
              </DropdownMenuItem>

              <DropdownMenuItem
                className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer"
                onSelect={handleCloneTrip}
                disabled={cloning}
              >
                <Copy className="h-4 w-4" />
                {cloning
                  ? t("trip.cloning", { defaultValue: "Cloning..." })
                  : t("trip.cloneTrip", { defaultValue: "Clone this trip" })}
              </DropdownMenuItem>

              {onRequestDeleteTrip && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2.5 rounded-xl px-3 py-2 text-xs font-medium cursor-pointer text-destructive focus:text-destructive"
                    onSelect={() => onRequestDeleteTrip(trip)}
                    disabled={submitting}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("trip.deleteTrip", { defaultValue: "Delete trip" })}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {error && <ErrorState className="mx-6 mt-3" message={error} />}

      {/* Main 2-Column Split Workspace */}
      <main className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Title, Metadata Tags, AI Greeting Card, Chats List & Bottom Dock Input */}
        <section className="lg:col-span-5 xl:col-span-5 flex flex-col h-full border-r border-border/60 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-2xs">
                  {destination}
                </span>
                <span className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-2xs">
                  {formatShortRange(trip.startDate, trip.endDate)}
                </span>
                <span className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-2xs">
                  {trip.travelerCount
                    ? `${trip.travelerCount} ${t("trip.travelers", { defaultValue: "travelers" })}`
                    : `1 ${t("trip.travelers", { defaultValue: "travelers" })}`}
                </span>
                <span className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground shadow-2xs">
                  {trip.budgetAmount
                    ? `${trip.budgetAmount.toLocaleString()} ${trip.budgetCurrency || "VND"}`
                    : t("trip.budget", { defaultValue: "Budget" })}
                </span>
              </div>
            </div>

            {!bannerDismissed && (
              <div className="relative rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground p-1 rounded-full cursor-pointer"
                  aria-label="Dismiss banner"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-foreground text-background shadow-xs">
                  <Sparkles className="h-3.5 w-3.5 fill-background stroke-background" />
                </div>
                <h3 className="mt-2 text-sm sm:text-base font-bold leading-snug tracking-tight text-foreground">
                  {destination}{" "}
                  {t("trip.openForPlanning", {
                    defaultValue: "is open for planning. Want ideas for what to do there?",
                  })}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPromptToAi(`Gợi ý các món ăn và nhà hàng đặc sản ngon nhất ở ${destination}`)
                    }
                    className="rounded-full bg-secondary hover:bg-secondary/80 px-3 py-1 text-xs font-semibold text-secondary-foreground transition-colors cursor-pointer"
                  >
                    {t("trip.showFoodIdeas", { defaultValue: "Show food ideas" })}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPromptToAi(`Lên kế hoạch các hoạt động ngày đầu tiên tại ${destination}`)
                    }
                    className="rounded-full bg-secondary hover:bg-secondary/80 px-3 py-1 text-xs font-semibold text-secondary-foreground transition-colors cursor-pointer"
                  >
                    {t("trip.planFirstActivities", {
                      defaultValue: "Plan first activities",
                    })}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendPromptToAi(`Gợi ý các khu vực và địa điểm nổi tiếng nhất tại ${destination}`)
                    }
                    className="rounded-full bg-secondary hover:bg-secondary/80 px-3 py-1 text-xs font-semibold text-secondary-foreground transition-colors cursor-pointer"
                  >
                    {t("trip.suggestNeighborhoods", {
                      defaultValue: "Suggest neighborhoods",
                    })}
                  </button>
                </div>
              </div>
            )}

            {/* Real Chats Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t("trip.chats", { defaultValue: "Chats" })}{" "}
                  <span className="font-semibold text-muted-foreground ml-1">
                    {tripChatSessions.length}
                  </span>
                </h3>
              </div>

              {loadingAiChats ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : tripChatSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center space-y-1">
                  <MessageSquare className="h-5 w-5 mx-auto text-muted-foreground" />
                  <p className="text-xs font-bold text-foreground">
                    {t("trip.noChatsYet", { defaultValue: "No chats for this trip yet." })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("trip.noChatsDesc", {
                      defaultValue: "Ask AI below to get instant food, activities, or place ideas!",
                    })}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tripChatSessions.map((session) => {
                    const isSelected = selectedChatSessionId === session.id;
                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "rounded-2xl border border-border bg-card p-3.5 shadow-xs transition-all hover:bg-accent/40 cursor-pointer",
                          isSelected && "ring-1.5 ring-primary/40 bg-accent/20",
                        )}
                        onClick={() =>
                          setSelectedChatSessionId(isSelected ? null : session.id)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                              {session.title || t("trip.untitledChat", { defaultValue: "Conversation" })}
                            </h4>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {formatDate(session.updatedAt || session.createdAt)}
                            </p>
                          </div>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                              isSelected && "rotate-90",
                            )}
                          />
                        </div>

                        {isSelected && (
                          <div
                            className="mt-3 pt-2.5 border-t border-border/60 space-y-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {loadingMessages ? (
                              <div className="flex items-center justify-center py-3">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            ) : sessionMessages.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic">
                                {t("trip.noMessagesInChat", {
                                  defaultValue: "No messages in this chat yet.",
                                })}
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {sessionMessages.map((msg) => {
                                  const text = extractMessageText(msg);
                                  if (!text) return null;
                                  const isUser = msg.role === "user";
                                  return (
                                    <div
                                      key={msg.id}
                                      className={cn(
                                        "rounded-xl p-2.5 text-xs font-medium leading-relaxed",
                                        isUser
                                          ? "bg-muted/80 text-foreground"
                                          : "bg-primary/10 border border-primary/20 text-foreground",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "font-bold mr-1.5",
                                          isUser ? "text-primary" : "text-primary/90",
                                        )}
                                      >
                                        {isUser ? "You:" : "TripSense AI:"}
                                      </span>
                                      {text}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="pt-1 flex justify-end">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-6 rounded-full px-2.5 text-[11px] font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
                              >
                                <Link href={`/ai-planner/${session.id}?tripId=${trip.id}`}>
                                  <span>
                                    {t("trip.openInAiPlanner", {
                                      defaultValue: "Open in AI Planner",
                                    })}
                                  </span>
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Docked Chat Input Bar - ALWAYS pinned and visible right at the bottom! */}
          <div className="shrink-0 border-t border-border/70 bg-background/95 backdrop-blur-md p-3 sm:px-4">
            <div className="flex items-center gap-2 rounded-full border border-border/90 bg-muted/30 p-1.5 pl-3 shadow-xs focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => itinerary?.days[0] && onAddItem(itinerary.days[0])}
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                title={t("trip.addSpot", { defaultValue: "Add to trip" })}
              >
                <Plus className="h-4 w-4" />
              </Button>
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
                placeholder={t("trip.chatPlaceholder", {
                  defaultValue: "Start a new chat for this trip",
                })}
                className="flex-1 bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Voice input"
                >
                  <Mic className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => handleSendPromptToAi(chatText)}
                  disabled={!chatText.trim()}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all cursor-pointer",
                    chatText.trim()
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted",
                  )}
                  aria-label="Send"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: 6 Feature Action Tiles + Large Interactive Map */}
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col h-full p-4 sm:p-5 gap-3 overflow-hidden">
          {activePanel === "overview" ? (
            <>
              {/* 6 Feature Action Tiles in 2 Columns */}
              <div className="grid grid-cols-2 gap-2.5 shrink-0">
                <ActionTile
                  icon={Lightbulb}
                  label={t("trip.ideas", { defaultValue: "Ideas" })}
                  onClick={() => setPollOpen(true)}
                />
                <ActionTile
                  icon={Compass}
                  label={t("trip.itinerary", { defaultValue: "Itinerary" })}
                  badge={itineraryPlacesCount > 0 ? `${itineraryPlacesCount}` : undefined}
                  onClick={() => setActivePanel("itinerary")}
                />
                <ActionTile
                  icon={Luggage}
                  label={t("trip.bookings", { defaultValue: "Bookings" })}
                  onClick={() => setChecklistOpen(true)}
                />
                <ActionTile
                  icon={FileText}
                  label={t("trip.media", { defaultValue: "Media" })}
                  onClick={() => onEditTrip(trip)}
                />
                <ActionTile
                  icon={Info}
                  label={t("trip.preferences", { defaultValue: "Trip preferences" })}
                  badge="1"
                  onClick={() => onEditTrip(trip)}
                />
                <ActionTile
                  icon={Calendar}
                  label={t("trip.calendar", { defaultValue: "Calendar" })}
                  href="/calendar"
                />
              </div>

              {/* Large Interactive Map with Marked Points */}
              <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
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
            </>
          ) : (
            /* Itinerary Mode: Side-by-Side Day Inspection with Interactive Map */
            <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">
              {/* Itinerary Header & Day Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border/80 shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActivePanel("overview")}
                    className="h-8 rounded-full px-2.5 text-xs font-semibold gap-1.5 hover:bg-muted cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>{t("trip.back", { defaultValue: "Back" })}</span>
                  </Button>
                  <h3 className="text-base font-bold tracking-tight text-foreground">
                    {t("trip.itinerary", { defaultValue: "Itinerary" })}
                  </h3>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {countTripDays(trip)} days · {itineraryPlacesCount} spots
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFitBoundsTrigger((prev) => prev + 1)}
                    className="h-7 rounded-full px-2.5 text-xs font-semibold gap-1 hover:bg-accent cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{t("trip.fitMap", { defaultValue: "Fit Map" })}</span>
                  </Button>
                  {itinerary?.days[0] && (
                    <Button
                      size="sm"
                      onClick={() => onAddItem(itinerary.days[0])}
                      className="h-7 rounded-full px-3 text-xs font-bold gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{t("trip.addSpot", { defaultValue: "Add Spot" })}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Day Selector Pills */}
              {itinerary?.days && itinerary.days.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                  <Button
                    variant={selectedDayNumber === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedDayNumber(null)}
                    className="h-7 rounded-full px-3 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    {t("trip.allDays", { defaultValue: "All Days" })}
                  </Button>
                  {itinerary.days.map((day) => (
                    <Button
                      key={day.id}
                      variant={selectedDayNumber === day.dayNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDayNumber(day.dayNumber)}
                      className="h-7 rounded-full px-3 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Day {day.dayNumber} ({formatDate(day.date)})
                    </Button>
                  ))}
                </div>
              )}

              {/* Itinerary Items & Map Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden">
                <div className="space-y-3 overflow-y-auto pr-1">
                  {itinerary?.days.map((day) => {
                    if (selectedDayNumber != null && day.dayNumber !== selectedDayNumber) {
                      return null;
                    }

                    return (
                      <div
                        key={day.id}
                        className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">
                              Day {day.dayNumber}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              · {formatDate(day.date)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAddItem(day)}
                            className="h-6 rounded-full px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {t("trip.addPlace", { defaultValue: "Add" })}
                          </Button>
                        </div>

                        {day.items.length === 0 ? (
                          <div className="rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground font-medium">
                            {t("trip.noPlacesPlanned", {
                              defaultValue: "No places planned for this day yet.",
                            })}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {day.items.map((item) => {
                              const isSelected = selectedPlaceId === item.id;
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => setSelectedPlaceId(item.id)}
                                  className={cn(
                                    "flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-background p-2.5 transition-all cursor-pointer hover:border-primary/50",
                                    isSelected && "ring-2 ring-primary/40 border-primary bg-primary/5",
                                  )}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-foreground truncate">
                                        {item.title}
                                      </span>
                                      <span className="text-micro font-semibold text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                                        {itemTypeLabel(item.type)}
                                      </span>
                                    </div>
                                    {formatDisplayTimeRange(item.startTime, item.endTime) && (
                                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {formatDisplayTimeRange(item.startTime, item.endTime)}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditItem(item);
                                      }}
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteItem(item);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right sub-column: Coordinated Map */}
                <div className="relative h-full min-h-0 rounded-2xl overflow-hidden border border-border shadow-xs">
                  <MapVinaContainer
                    places={mapPlaces}
                    selectedPlaceId={selectedPlaceId}
                    onSelectPlace={setSelectedPlaceId}
                    center={centerCoordinates}
                    zoom={mapPlaces.length > 1 ? 13 : 14}
                    fitBoundsTrigger={fitBoundsTrigger}
                    className="h-full w-full"
                  />
                </div>
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
    <div className="flex h-13 items-center justify-between rounded-2xl border border-border/80 bg-card px-4 py-2.5 text-sm font-bold shadow-xs transition-all duration-200 hover:bg-accent/60 cursor-pointer">
      <span className="flex items-center gap-3 text-foreground min-w-0">
        <Icon className="h-4 w-4 text-foreground/80 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground shrink-0">
          {badge}
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" className="text-left w-full cursor-pointer" onClick={onClick}>
      {content}
    </button>
  );
}
