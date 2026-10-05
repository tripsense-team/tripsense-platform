"use client";

import * as React from "react";
import { MessageSquare, Plus, Search, Bell, BellOff, X, ShieldAlert, SquarePen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Conversation, ConversationTab } from "../types/chat.types";
import { EmptyInboxState, EmptySearchState } from "./chat-states";
import { formatConversationTime } from "../utils/format-chat-time";
import { useFcmNotifications } from "../hooks/use-fcm-notifications";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onOpenNewChat: () => void;
  onManageBlocks?: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeTab: ConversationTab;
  onTabChange: (tab: ConversationTab) => void;
  requestCount: number;
  totalUnreadCount: number;
  className?: string;
}

export function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenNewChat,
  onManageBlocks,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  requestCount,
  totalUnreadCount,
  className,
}: ChatSidebarProps) {
  const { t, locale } = useTranslation();
  const {
    permission: notificationPermission,
    requestPermission,
    sendTestNotification,
  } = useFcmNotifications();

  // Filter conversations by tab and search query
  const filteredConversations = React.useMemo(() => {
    let list = conversations;

    if (activeTab === "requests") {
      list = list.filter((c) => c.isRequest);
    } else {
      list = list.filter((c) => !c.isRequest);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (c) =>
          c.user.name.toLowerCase().includes(query) ||
          c.lastMessage.toLowerCase().includes(query)
      );
    }

    return list;
  }, [conversations, activeTab, searchQuery]);

  return (
    <aside
      className={cn(
        "w-full md:w-[360px] lg:w-[400px] xl:w-[440px] flex flex-col bg-card shrink-0 select-none",
        className
      )}
      aria-label={t("chat.messages")}
    >
      {/* 1. Header: Messenger-style bold title with circle action buttons */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-2xl sm:text-[26px] font-bold text-foreground tracking-tight truncate">
            {t("chat.messages")}
          </h2>
          {totalUnreadCount > 0 && (
            <Badge
              variant="secondary"
              className="h-6 px-2.5 min-w-[22px] rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0"
            >
              {totalUnreadCount}
            </Badge>
          )}
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2 shrink-0">
            {onManageBlocks && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onManageBlocks}
                    aria-label={t("chat.blocks.title")}
                    className="h-10 w-10 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <ShieldAlert className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {t("chat.blocks.title")}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenNewChat}
                  aria-label={t("chat.dialogs.newChat.title")}
                  className="h-10 w-10 rounded-full bg-muted/70 text-foreground hover:bg-muted hover:text-primary transition-colors shadow-2xs"
                >
                  <SquarePen className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("chat.dialogs.newChat.title")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={notificationPermission === "granted" ? sendTestNotification : requestPermission}
                  aria-label={notificationPermission === "granted" ? "Thử thông báo desktop" : "Bật thông báo"}
                  className="h-10 w-10 rounded-full bg-muted/70 text-foreground hover:bg-muted hover:text-primary transition-colors shadow-2xs"
                >
                  <Bell className={cn("h-5 w-5", notificationPermission === "granted" ? "text-primary" : "text-muted-foreground")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {notificationPermission === "granted" ? "Gửi thông báo thử nghiệm" : "Bật thông báo đẩy"}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 2. Search Input */}
      <div className="px-5 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            aria-label={t("chat.searchPlaceholder")}
            className="pl-11 pr-10 bg-muted/50 hover:bg-muted/70 focus-visible:bg-card border-none rounded-full text-[15px] sm:text-base h-11 shadow-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label={t("common.clear")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Filter Tabs: All and Requests only */}
      <div className="px-5 py-2 flex items-center gap-2.5 shrink-0" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "all"}
          onClick={() => onTabChange("all")}
          className={cn(
            "px-4.5 py-2 rounded-full text-sm sm:text-base transition-all select-none",
            activeTab === "all"
              ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
          )}
        >
          {t("chat.tabs.all")}
        </button>

        <button
          role="tab"
          aria-selected={activeTab === "requests"}
          onClick={() => onTabChange("requests")}
          className={cn(
            "px-4.5 py-2 rounded-full text-sm sm:text-base transition-all flex items-center gap-2 select-none",
            activeTab === "requests"
              ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
          )}
        >
          <span>{t("chat.tabs.requests")}</span>
          {requestCount > 0 && (
            <span
              className={cn(
                "h-5.5 min-w-[22px] px-2 rounded-full text-xs font-bold flex items-center justify-center",
                activeTab === "requests"
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary/20 text-primary"
              )}
            >
              {requestCount}
            </span>
          )}
        </button>
      </div>

      {/* 4. Conversation List */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1">
        {filteredConversations.length === 0 ? (
          searchQuery ? (
            <EmptySearchState query={searchQuery} />
          ) : activeTab === "requests" ? (
            <div className="p-8 text-center text-sm sm:text-base text-muted-foreground">
              {t("chat.empty.noRequestsDesc")}
            </div>
          ) : (
            <EmptyInboxState onNewChat={onOpenNewChat} />
          )
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isUnread = conv.unreadCount > 0;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  "w-full p-3 sm:p-3.5 rounded-2xl flex items-center gap-3.5 text-left transition-colors relative group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "bg-muted text-foreground font-medium shadow-2xs"
                    : "hover:bg-muted/60 text-muted-foreground"
                )}
                aria-current={isActive ? "true" : undefined}
              >
                {/* Avatar with semantic online dot */}
                <div className="relative shrink-0">
                  <Avatar className="h-13 w-13 sm:h-14 sm:w-14 border border-border/70">
                    <AvatarImage src={conv.user.avatar} alt={conv.user.name} />
                    <AvatarFallback className="text-base font-bold bg-muted text-foreground">
                      {conv.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {conv.user.isOnline && (
                    <span
                      className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 ring-2.5 ring-card"
                      title={t("chat.status.activeNow")}
                    />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={cn(
                        "text-[15px] sm:text-base truncate transition-colors",
                        isUnread
                          ? "text-foreground font-bold"
                          : "text-foreground/90 font-semibold"
                      )}
                    >
                      {conv.user.name}
                    </span>
                    <span
                      className={cn(
                        "text-xs sm:text-sm shrink-0",
                        isUnread
                          ? "text-primary font-bold"
                          : "text-muted-foreground/75 font-medium"
                      )}
                    >
                      {formatConversationTime(
                        conv.lastMessageTime || conv.lastMessageTimestamp,
                        locale
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm sm:text-[15px] truncate max-w-[240px] leading-normal",
                        isUnread
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground/80"
                      )}
                    >
                      {conv.lastMessage || t("chat.thread.emptyThread")}
                    </p>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {conv.isMuted && (
                        <BellOff className="h-4 w-4 text-muted-foreground/60" />
                      )}
                      {isUnread && (
                        <Badge className="h-5.5 px-2 min-w-[22px] rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
