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
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useUserTrips } from "@/features/trip-management/hooks/use-user-trips";
import type { TripResponse } from "@/features/trip-management/types";
import { useAiDrawerStore } from "@/stores/use-ai-drawer-store";
import {
  type ChatSession,
  useAiChatSessions,
  useDeleteAiChatMutation,
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
 * Intelligent helper to extract or match destination subtitle
 * from chat title or linked user trips matching Mindtrip screenshot.
 */
function getChatSubtitle(chatTitle: string, trips: TripResponse[]): string | null {
  if (!chatTitle) return null;
  const lower = chatTitle.toLowerCase();

  // 1. Direct match against user trips
  const matched = trips.find(
    (t) =>
      (t.destinationName && lower.includes(t.destinationName.toLowerCase())) ||
      (t.name && lower.includes(t.name.toLowerCase()))
  );
  if (matched) {
    return matched.name || `Trip to ${matched.destinationName}`;
  }

  // 2. Keyword detection for common destinations matching Mindtrip screenshot
  if (lower.includes("huế") || lower.includes("hue")) return "Trip to Hue";
  if (
    lower.includes("quảng trị") ||
    lower.includes("hướng hóa") ||
    lower.includes("quang tri")
  )
    return "Trip to Quang Tri";
  if (lower.includes("đà nẵng") || lower.includes("da nang"))
    return "Trip to Da Nang";
  if (lower.includes("hà nội") || lower.includes("ha noi"))
    return "Trip to Ha Noi";
  if (
    lower.includes("hồ chí minh") ||
    lower.includes("sài gòn") ||
    lower.includes("saigon")
  )
    return "Trip to Ho Chi Minh";
  if (lower.includes("phú quốc") || lower.includes("phu quoc"))
    return "Trip to Phu Quoc";
  if (lower.includes("đà lạt") || lower.includes("da lat"))
    return "Trip to Da Lat";
  if (lower.includes("hội an") || lower.includes("hoi an"))
    return "Trip to Hoi An";
  if (lower.includes("nha trang")) return "Trip to Nha Trang";
  if (lower.includes("scotland")) return "Trip to Scotland";

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

  // Filtered trips based on search query
  const filteredTrips = React.useMemo(() => {
    if (!searchQuery.trim()) return trips;
    const q = searchQuery.toLowerCase();
    return trips.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.destinationName?.toLowerCase().includes(q)
    );
  }, [trips, searchQuery]);

  // Filtered chats based on search query
  const filteredChats = React.useMemo(() => {
    if (!searchQuery.trim()) return chatList;
    const q = searchQuery.toLowerCase();
    return chatList.filter((c) => {
      const sub = getChatSubtitle(c.title, trips)?.toLowerCase();
      return (
        c.title?.toLowerCase().includes(q) ||
        (sub && sub.includes(q))
      );
    });
  }, [chatList, trips, searchQuery]);

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
              placeholder="Search..."
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
                title="Thu gọn"
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
              <span>New chat</span>
            </button>
            <button
              onClick={() => {
                router.push("/trips/new");
                handleCloseDrawer();
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-semibold text-foreground/90 hover:bg-muted/60 transition-all text-left group cursor-pointer"
            >
              <Luggage className="size-5 text-foreground/75 group-hover:text-foreground transition-colors shrink-0" />
              <span>New trip</span>
            </button>
          </div>

          {/* 3. Update my assistant */}
          <div className="py-2.5 border-b border-border/30">
            <p className="text-[12px] font-semibold text-foreground/90 px-3 mb-1">
              Update my assistant
            </p>
            <button
              onClick={() => {
                router.push("/settings?tab=personalization");
                handleCloseDrawer();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium text-foreground/90 hover:bg-muted/60 transition-all text-left group cursor-pointer"
            >
              <Settings className="size-5 text-foreground/75 group-hover:text-foreground transition-colors shrink-0" />
              <span>Personalization</span>
            </button>
          </div>

          {/* 4. Trips Section */}
          <div className="py-3 border-b border-border/30">
            <p className="text-[11px] font-semibold text-muted-foreground/80 px-3 mb-1.5 tracking-wide">
              Trips
            </p>
            <div className="flex flex-col gap-0.5">
              {filteredTrips.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">
                  {searchQuery ? "No matching trips" : "Chưa có chuyến đi nào"}
                </p>
              ) : (
                filteredTrips.slice(0, 10).map((trip) => (
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
                          alt={trip.name}
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
                      {trip.name || trip.destinationName || "Chuyến đi"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 5. Chats Section */}
          <div className="py-3 pb-6">
            <p className="text-[11px] font-semibold text-muted-foreground/80 px-3 mb-1.5 tracking-wide">
              Chats
            </p>
            <div className="flex flex-col gap-1">
              {filteredChats.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 px-3 py-1 italic">
                  {searchQuery ? "No matching chats" : "Chưa có cuộc trò chuyện"}
                </p>
              ) : (
                filteredChats.map((chat) => {
                  const isSelected = activeChatId === chat.id;
                  const subtitle = getChatSubtitle(chat.title, trips);

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
                          title={chat.title}
                        >
                          {chat.title}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChatAction(chat.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive p-0.5 rounded transition-all shrink-0 -mr-1 cursor-pointer"
                          title="Xoá hội thoại"
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
                })
              )}
            </div>
          </div>
        </div>
      </aside>
  );
}
