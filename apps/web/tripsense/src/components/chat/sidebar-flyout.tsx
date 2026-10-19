"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  SquarePen,
  Luggage,
  Settings,
  X,
  Trash2,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useUserTrips } from "@/features/trip-management/hooks/use-user-trips";
import type { TripResponse } from "@/features/trip-management/types";
import { useAiDrawerStore } from "@/stores/use-ai-drawer-store";
import {
  type ChatSession,
  useAiChatSessions,
  useDeleteAiChatMutation,
  isGenericChatTitle,
} from "@/hooks/use-ai-chats";

export interface SidebarFlyoutProps {
  chatId?: string;
  chatList?: ChatSession[];
  onSelectChat?: (chat: ChatSession) => void;
  onNewChat?: () => void;
  onDeleteChat?: (chatId: string) => void;
  className?: string;
}

/**
 * Intelligent helper to format trip titles according to active locale.
 * Also adapts existing legacy "Trip to <Dest>" names when locale is "vi".
 */
export function formatTripTitle(
  name: string | undefined,
  destinationName: string | undefined,
  locale: string
): string {
  const prefix = locale === "vi" ? "Chuyến đi" : "Trip to";
  const raw = name || (destinationName ? `${prefix} ${destinationName}` : (locale === "vi" ? "Chuyến đi" : "Trip"));
  if (locale === "vi" && raw.startsWith("Trip to ")) {
    return `Chuyến đi ${raw.slice(8)}`;
  }
  if (locale === "en" && raw.startsWith("Chuyến đi ")) {
    return `Trip to ${raw.slice(10)}`;
  }
  return raw;
}

/**
 * Intelligent helper to extract or match destination subtitle
 * from chat title or linked user trips matching Mindtrip screenshot.
 */
function getChatSubtitle(
  chatTitle: string,
  trips: TripResponse[],
  locale: string
): string | null {
  if (!chatTitle) return null;
  const lower = chatTitle.toLowerCase();
  const prefix = locale === "vi" ? "Chuyến đi" : "Trip to";

  // 1. Direct match against user trips
  const matched = trips.find(
    (t) =>
      (t.destinationName && lower.includes(t.destinationName.toLowerCase())) ||
      (t.name && lower.includes(t.name.toLowerCase()))
  );
  if (matched) {
    return formatTripTitle(matched.name, matched.destinationName, locale);
  }

  // 2. Keyword detection for common destinations matching Mindtrip screenshot
  if (lower.includes("huế") || lower.includes("hue")) return `${prefix} Huế`;
  if (
    lower.includes("quảng trị") ||
    lower.includes("hướng hóa") ||
    lower.includes("quang tri")
  )
    return `${prefix} Quảng Trị`;
  if (lower.includes("đà nẵng") || lower.includes("da nang"))
    return `${prefix} Đà Nẵng`;
  if (lower.includes("hà nội") || lower.includes("ha noi"))
    return `${prefix} Hà Nội`;
  if (
    lower.includes("hồ chí minh") ||
    lower.includes("sài gòn") ||
    lower.includes("saigon")
  )
    return `${prefix} TP. Hồ Chí Minh`;
  if (lower.includes("phú quốc") || lower.includes("phu quoc"))
    return `${prefix} Phú Quốc`;
  if (lower.includes("đà lạt") || lower.includes("da lat"))
    return `${prefix} Đà Lạt`;
  if (lower.includes("hội an") || lower.includes("hoi an"))
    return `${prefix} Hội An`;
  if (lower.includes("nha trang")) return `${prefix} Nha Trang`;
  if (lower.includes("bangkok")) return `${prefix} Bangkok`;
  if (lower.includes("tokyo")) return `${prefix} Tokyo`;
  if (lower.includes("scotland")) return `${prefix} Scotland`;

  return null;
}

export function SidebarFlyout({
  chatId: propChatId,
  chatList: propChatList,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  className,
}: SidebarFlyoutProps = {}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const params = useParams<{ chatId?: string }>();
  const searchParams = useSearchParams();
  const activeChatId = propChatId || params?.chatId || searchParams?.get("chatId") || undefined;
  const { trips } = useUserTrips();
  const { data: serverChats } = useAiChatSessions();
  const deleteMutation = useDeleteAiChatMutation();

  const chatList = propChatList || serverChats || [];
  const flyoutRef = React.useRef<HTMLElement>(null);

  const {
    isOpen,
    setIsOpen,
    toggleDrawer,
    searchQuery,
    setSearchQuery,
  } = useAiDrawerStore();

  const handleCloseDrawer = React.useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Click outside flyout listener (ignores trigger clicks) and Escape key listener
  React.useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-ai-trigger], [data-ai-v2-trigger]")) {
          return;
        }
        handleCloseDrawer();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleCloseDrawer();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleCloseDrawer]);

  const handleNewChatAction = React.useCallback(() => {
    handleCloseDrawer();
    if (onNewChat) {
      onNewChat();
    }
    router.push("/ai-planner");
  }, [handleCloseDrawer, onNewChat, router]);

  const handleSelectChatAction = React.useCallback(
    (chat: ChatSession) => {
      handleCloseDrawer();
      if (onSelectChat) {
        onSelectChat(chat);
      }
      router.push(`/ai-planner/${chat.id}`);
    },
    [handleCloseDrawer, onSelectChat, router]
  );

  const handleDeleteChatAction = React.useCallback(
    async (targetChatId: string) => {
      if (onDeleteChat) {
        onDeleteChat(targetChatId);
      } else {
        try {
          await deleteMutation.mutateAsync(targetChatId);
        } catch (err) {
          console.error("Failed to delete chat:", err);
        }
      }
    },
    [deleteMutation, onDeleteChat]
  );

  const INITIAL_VISIBLE_COUNT = 3;
  const PAGE_INCREMENT = 4;
  const [visibleTripsCount, setVisibleTripsCount] = React.useState(INITIAL_VISIBLE_COUNT);
  const [visibleChatsCount, setVisibleChatsCount] = React.useState(INITIAL_VISIBLE_COUNT);

  React.useEffect(() => {
    setVisibleTripsCount(INITIAL_VISIBLE_COUNT);
    setVisibleChatsCount(INITIAL_VISIBLE_COUNT);
  }, [searchQuery]);

  // Sorted and filtered trips based on search query (newest first)
  const sortedTrips = React.useMemo(() => {
    return [...trips].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [trips]);

  const filteredTrips = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedTrips;
    const q = searchQuery.toLowerCase();
    return sortedTrips.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.destinationName?.toLowerCase().includes(q)
    );
  }, [sortedTrips, searchQuery]);

  // Sorted and filtered chats based on search query (newest first)
  const sortedChats = React.useMemo(() => {
    return [...chatList].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [chatList]);

  const filteredChats = React.useMemo(() => {
    if (!searchQuery.trim()) return sortedChats;
    const q = searchQuery.toLowerCase();
    return sortedChats.filter((c) => {
      const sub = getChatSubtitle(c.title, trips, locale)?.toLowerCase();
      return (
        c.title?.toLowerCase().includes(q) ||
        (sub && sub.includes(q))
      );
    });
  }, [sortedChats, trips, searchQuery, locale]);

  // When not hovered or open, completely hide drawer (Image 2)
  if (!isOpen) {
    return null;
  }

  return (
    <aside
      ref={flyoutRef}
      className={cn(
        "absolute inset-y-0 left-0 md:left-16 z-50 flex flex-col h-full w-72 sm:w-80 md:w-84 shrink-0 bg-background border-r border-y border-border/80 rounded-r-2xl shadow-2xl shadow-black/25 select-none overflow-hidden transition-all duration-200 animate-in fade-in-0 slide-in-from-left-4",
        className
      )}
    >
        {/* 1. Search Bar */}
        <div className="p-3.5 pb-2 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 size-4 text-muted-foreground/70 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("aiPlanner.searchChatsAndTrips")}
              className="w-full pl-9 pr-8 py-2 bg-muted/50 hover:bg-muted/70 focus:bg-background rounded-full text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/40 border border-border/30 transition-all text-foreground"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-full cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <button
                onClick={toggleDrawer}
                className="absolute right-2.5 text-muted-foreground/60 hover:text-foreground p-0.5 rounded-full cursor-pointer"
                title={locale === "vi" ? "Thu gọn" : "Collapse"}
              >
                <ChevronLeft className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-3">
          {/* 2. Quick Actions: New chat & New trip */}
          <div className="flex flex-col gap-0.5 py-1.5 border-b border-border/30">
            <button
              onClick={handleNewChatAction}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-semibold text-foreground/90 hover:bg-muted/60 transition-all text-left group cursor-pointer"
            >
              <SquarePen className="size-5 text-foreground/75 group-hover:text-foreground transition-colors shrink-0" />
              <span>{t("aiPlanner.newChat")}</span>
            </button>
            <button
              onClick={() => {
                router.push("/trips/new");
                handleCloseDrawer();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-semibold text-foreground/90 hover:bg-muted/60 transition-all text-left group cursor-pointer"
            >
              <Luggage className="size-5 text-foreground/75 group-hover:text-foreground transition-colors shrink-0" />
              <span>{t("trip.newTrip")}</span>
            </button>
          </div>

          {/* 3. Update my assistant */}
          <div className="py-2.5 border-b border-border/30">
            <p className="text-[12px] font-semibold text-foreground/90 px-3 mb-1">
              {t("aiPlanner.updateAssistant")}
            </p>
            <button
              onClick={() => {
                router.push("/settings?tab=personalization");
                handleCloseDrawer();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium text-foreground/90 hover:bg-muted/60 transition-all text-left group cursor-pointer"
            >
              <Settings className="size-5 text-foreground/75 group-hover:text-foreground transition-colors shrink-0" />
              <span>{t("nav.personalization")}</span>
            </button>
          </div>

          {/* 4. Trips Section */}
          <div className="py-3 border-b border-border/30">
            <p className="text-[11px] font-semibold text-muted-foreground/80 px-3 mb-1.5 tracking-wide">
              {t("aiPlanner.sidebarTripsHeader")}
            </p>
            <div className="flex flex-col gap-0.5">
              {filteredTrips.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">
                  {searchQuery ? t("trip.noMatchingTrips") : t("trip.emptyTripsShort")}
                </p>
              ) : (
                <>
                  {filteredTrips.slice(0, visibleTripsCount).map((trip) => {
                    const title = formatTripTitle(trip.name, trip.destinationName, locale);
                    return (
                      <div
                        key={trip.id}
                        onClick={() => {
                          router.push(`/trips/${trip.id}`);
                          handleCloseDrawer();
                        }}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors text-left cursor-pointer group"
                      >
                        {/* Photo thumbnail or fallback luggage icon */}
                        {trip.coverImageUrl ? (
                          <div className="relative size-7 rounded-lg overflow-hidden shrink-0 border border-border/40">
                            <Image
                              src={trip.coverImageUrl}
                              alt={title}
                              fill
                              sizes="28px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="size-7 rounded-lg bg-muted/80 flex items-center justify-center text-muted-foreground shrink-0 border border-border/40">
                            <Luggage className="size-3.5" />
                          </div>
                        )}
                        <span className="text-[14px] font-medium text-foreground/90 truncate flex-1">
                          {title}
                        </span>
                      </div>
                    );
                  })}

                  {filteredTrips.length > INITIAL_VISIBLE_COUNT && (
                    <>
                      {visibleTripsCount < filteredTrips.length ? (
                        visibleTripsCount > INITIAL_VISIBLE_COUNT ? (
                          <div className="flex items-center justify-between px-0.5 mt-0.5">
                            <button
                              type="button"
                              onClick={() => setVisibleTripsCount((v) => v + PAGE_INCREMENT)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>
                                {`${t("common.showMore")} (${filteredTrips.length - visibleTripsCount})`}
                              </span>
                              <ChevronDown className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisibleTripsCount(INITIAL_VISIBLE_COUNT)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>{t("common.showLess")}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVisibleTripsCount((v) => v + PAGE_INCREMENT)}
                            className="flex items-center justify-between px-3 py-1.5 mt-0.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer w-full"
                          >
                            <span>
                              {`${t("common.showMore")} (${filteredTrips.length - visibleTripsCount})`}
                            </span>
                            <ChevronDown className="size-3.5" />
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVisibleTripsCount(INITIAL_VISIBLE_COUNT)}
                          className="flex items-center justify-between px-3 py-1.5 mt-0.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer w-full"
                        >
                          <span>{t("common.showLess")}</span>
                          <ChevronDown className="size-3.5 rotate-180" />
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 5. Chats Section */}
          <div className="py-3 pb-6">
            <p className="text-[11px] font-semibold text-muted-foreground/80 px-3 mb-1.5 tracking-wide">
              {t("aiPlanner.sidebarChatsHeader")}
            </p>
            <div className="flex flex-col gap-1">
              {filteredChats.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">
                  {searchQuery ? t("aiPlanner.noMatchingChats") : t("aiPlanner.emptyChats")}
                </p>
              ) : (
                <>
                  {filteredChats.slice(0, visibleChatsCount).map((chat) => {
                    const isSelected = activeChatId === chat.id;
                    const subtitle = getChatSubtitle(chat.title, trips, locale);
                    const isGeneric = isGenericChatTitle(chat.title);
                    const displayTitle = isGeneric
                      ? (subtitle || (locale === "vi" ? "Lịch trình chuyến đi" : "Trip itinerary"))
                      : chat.title;

                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChatAction(chat)}
                        className={cn(
                          "group relative flex flex-col justify-center px-3 py-2 rounded-xl transition-all text-left cursor-pointer",
                          isSelected
                            ? "bg-muted/80 shadow-2xs text-foreground"
                            : "hover:bg-muted/50 text-foreground/90"
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p
                            className={cn(
                              "text-[14px] truncate pr-5",
                              isSelected ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                            )}
                            title={displayTitle}
                          >
                            {displayTitle}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteChatAction(chat.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive p-0.5 rounded transition-all shrink-0 -mr-1 cursor-pointer"
                            title={t("aiPlanner.deleteChatAction")}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>

                        {/* Destination subtitle matching screenshot */}
                        {subtitle && (
                          <p className="text-[11px] text-muted-foreground/75 truncate mt-0.5">
                            {subtitle}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {filteredChats.length > INITIAL_VISIBLE_COUNT && (
                    <>
                      {visibleChatsCount < filteredChats.length ? (
                        visibleChatsCount > INITIAL_VISIBLE_COUNT ? (
                          <div className="flex items-center justify-between px-0.5 mt-0.5">
                            <button
                              type="button"
                              onClick={() => setVisibleChatsCount((v) => v + PAGE_INCREMENT)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>
                                {`${t("common.showMore")} (${filteredChats.length - visibleChatsCount})`}
                              </span>
                              <ChevronDown className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setVisibleChatsCount(INITIAL_VISIBLE_COUNT)}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-xl transition-colors cursor-pointer"
                            >
                              <span>{t("common.showLess")}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVisibleChatsCount((v) => v + PAGE_INCREMENT)}
                            className="flex items-center justify-between px-3 py-1.5 mt-0.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer w-full"
                          >
                            <span>
                              {`${t("common.showMore")} (${filteredChats.length - visibleChatsCount})`}
                            </span>
                            <ChevronDown className="size-3.5" />
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVisibleChatsCount(INITIAL_VISIBLE_COUNT)}
                          className="flex items-center justify-between px-3 py-1.5 mt-0.5 text-xs font-semibold text-primary/90 hover:text-primary hover:bg-muted/40 rounded-xl transition-colors cursor-pointer w-full"
                        >
                          <span>{t("common.showLess")}</span>
                          <ChevronDown className="size-3.5 rotate-180" />
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
  );
}
