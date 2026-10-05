"use client";

import * as React from "react";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useTranslation } from "@/i18n";
import type { ChatMessageItem, ChatUser, Conversation, ConversationTab } from "../types/chat.types";
import { CURRENT_USER_ID } from "../types/chat.types";
import { chatApi, toChatMessage, toConversation } from "../services/chat-api";
import { ChatSidebar } from "./chat-sidebar";
import { ChatThread } from "./chat-thread";
import { NewChatDialog } from "./new-chat-dialog";
import { ShareTripDialog } from "./share-trip-dialog";
import { BlockedUsersDialog } from "./blocked-users-dialog";
import { useSearchParams } from "next/navigation";
import { ChatSidebarSkeleton, ChatThreadSkeleton } from "./chat-states";
import { cn } from "@/lib/utils";

export function UserChatWorkspace() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("userId");
  const targetThreadId = searchParams.get("t") || searchParams.get("id");
  const userId = useAuthStore((state) => state.user?.id);
  const authVersion = useAuthStore((state) => state.authVersion);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<ConversationTab>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const [shareTripOpen,setShareTripOpen] = React.useState(false);
  const [blocksOpen,setBlocksOpen] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<"list" | "thread">("list");
  const [isLoading, setIsLoading] = React.useState(true);
  const alive = React.useRef(true);
  const currentId = React.useRef("");
  const refreshRef = React.useRef<() => Promise<void>>(async () => {});
  React.useEffect(() => { currentId.current = activeConvId; }, [activeConvId]);

  // Handle direct navigation to user via /chat?userId=...
  React.useEffect(() => {
    if (!userId || !targetUserId || isLoading) return;

    const existing = conversations.find((c) => c.user.id === targetUserId);
    if (existing) {
      setActiveConvId(existing.id);
      setActiveTab("all");
      setMobileView("thread");
      return;
    }

    let canceled = false;
    void chatApi
      .create(targetUserId)
      .then((server) => {
        if (canceled || !alive.current) return;
        const mapped = toConversation(server, userId);
        setConversations((old) => [
          mapped,
          ...old.filter((c) => c.id !== mapped.id),
        ]);
        setActiveConvId(mapped.id);
        setActiveTab("all");
        setMobileView("thread");
      })
      .catch(() => {
        // Ignored if target user doesn't exist
      });

    return () => {
      canceled = true;
    };
  }, [userId, targetUserId, isLoading]);

  const refresh = React.useCallback(async () => {
    if (!userId) return;
    try {
      const rows = [] as Awaited<ReturnType<typeof chatApi.list>>["items"];
      let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const result = await chatApi.list(cursor || undefined);
        rows.push(...result.items);
        cursor = result.nextCursor;
        if (!cursor) break;
      }
      if (!alive.current) return;
      setConversations((old) => rows.map((item) => toConversation(item, userId, old.find((entry) => entry.id === item.id)?.messages)));
      const targetFromUrl = searchParams.get("t") || searchParams.get("id");
      setActiveConvId((id) => {
        if (targetFromUrl && rows.some((row) => row.id === targetFromUrl)) {
          return targetFromUrl;
        }
        return id && rows.some((row) => row.id === id)
          ? id
          : (rows.find((row) => row.requestDirection !== "INCOMING")?.id || rows[0]?.id || "");
      });
    } catch {
      // Gracefully handle connection without blocking UI (Messenger/Telegram pattern)
    } finally {
      if (alive.current) setIsLoading(false);
    }
  }, [userId]);
  React.useEffect(() => { refreshRef.current = refresh; }, [refresh]);

  const loadThread = React.useCallback(async (id: string) => {
    if (!userId || !id) return;
    try {
      const page = await chatApi.messages(id);
      if (!alive.current) return;
      const messages = page.items.slice().reverse().map((message) => toChatMessage(message,userId));
      setConversations((old) => old.map((c) => {
        if(c.id!==id)return c;
        const serverKeys=new Set(messages.map((m)=>m.clientMessageId));
        const pending=c.messages.filter((m)=>(m.status==="failed"||m.status==="sending") && !serverKeys.has(m.clientMessageId));
        return {...c,messages:[...messages,...pending],olderCursor:page.nextCursor};
      }));
      const latest = page.items[0];
      if (latest) {
        await chatApi.delivered(id,latest.seq);
        if (currentId.current === id && document.visibilityState === "visible") {
          await chatApi.read(id,latest.seq);
          if (alive.current) {
            setConversations((old) => old.map((c) => c.id === id ? {...c,unreadCount:0} : c));
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("chat:unread-changed"));
            }
          }
        }
      }
    } catch {
      // Silently handle thread fetch failure without disruptive banners
    }
  }, [userId]);

  React.useEffect(() => {
    alive.current = true;
    setConversations([]);
    setActiveConvId("");
    setIsLoading(true);
    if (userId) void refresh();
    return () => { alive.current = false; };
  }, [userId,authVersion,refresh]);

  React.useEffect(() => {
    if (activeConvId) void loadThread(activeConvId);
  }, [activeConvId,loadThread]);

  React.useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let stopped = false;
    const reconcile = async () => {
      await refreshRef.current();
      if (currentId.current) await loadThread(currentId.current);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chat:unread-changed"));
      }
    };
    const stream = async () => {
      let backoffMs = 2000;
      while (!stopped) {
        const currentAuth = useAuthStore.getState();
        if (currentAuth.status === "unauthenticated" || !currentAuth.user) {
          break;
        }
        try {
          const response = await chatApi.stream(controller.signal);
          if (response.status === 401 || response.status === 403) {
            const checkAuth = useAuthStore.getState();
            if (checkAuth.status === "unauthenticated" || !checkAuth.user) {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10000));
            continue;
          }
          if (!response.ok || !response.body) throw new Error("stream unavailable");
          backoffMs = 2000;
          await reconcile();
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (!stopped) {
            const next = await reader.read();
            if (next.done) break;
            buffer += decoder.decode(next.value,{stream:true});
            const chunks = buffer.split(/\r?\n\r?\n/);
            buffer = chunks.pop() || "";
            if (chunks.some((chunk) => chunk.includes("event: chat.changed"))) await reconcile();
          }
        } catch {
          // SSE reconnects silently in background with exponential backoff
        }
        if (!stopped) {
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          backoffMs = Math.min(backoffMs * 1.5, 15000);
        }
      }
    };
    void stream();
    const timer = window.setInterval(() => { void reconcile(); },30000);
    const onFocus = () => { if (document.visibilityState === "visible") void reconcile(); };
    document.addEventListener("visibilitychange",onFocus);
    window.addEventListener("focus",onFocus);
    return () => {
      stopped = true; controller.abort(); window.clearInterval(timer);
      document.removeEventListener("visibilitychange",onFocus);
      window.removeEventListener("focus",onFocus);
    };
  }, [userId,authVersion,loadThread]);

  const activeConversation = conversations.find((c) => c.id === activeConvId);
  const totalUnreadCount = conversations.reduce((sum,c) => sum+c.unreadCount,0);
  const requestCount = conversations.filter((c) => c.isRequest).length;

  // Keep browser URL (?t=...) synchronized with active conversation like Messenger
  React.useEffect(() => {
    if (activeConvId && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("t") !== activeConvId) {
        url.searchParams.set("t", activeConvId);
        url.searchParams.delete("userId");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [activeConvId]);

  const selectConversation = (id: string) => {
    setActiveConvId(id);
    setMobileView("thread");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("t") !== id) {
        url.searchParams.set("t", id);
        url.searchParams.delete("userId");
        window.history.replaceState(null, "", url.toString());
      }
    }
    if (id === activeConvId) void loadThread(id);
  };
  const sendWithKey = async (id: string, text: string, key: string, sharedPostId?: string) => {
    try {
      const sent = sharedPostId ? await chatApi.sharedTrip(id,key,sharedPostId) : await chatApi.send(id,key,text);
      if (!alive.current) return;
      setConversations((old) => old.map((c) => c.id !== id ? c : {
        ...c,state:c.state === "DRAFT" ? "PENDING" : c.state,
        requestDirection:c.state === "DRAFT" ? "OUTGOING" : c.requestDirection,
        messages:c.messages.map((m) => m.clientMessageId === key ? toChatMessage(sent,userId || "") : m),
      }));
      await refresh();
    } catch {
      if (alive.current) setConversations((old) => old.map((c) => c.id !== id ? c : ({
        ...c,messages:c.messages.map((m) => m.clientMessageId === key ? {...m,status:"failed"} : m),
      })));
    }
  };
  const sendMessage = (text: string) => {
    if (!activeConvId || !userId) return;
    const key = crypto.randomUUID();
    const draft: ChatMessageItem = {id:`pending-${key}`,clientMessageId:key,senderId:CURRENT_USER_ID,
      text,createdAt:new Date().toISOString(),status:"sending"};
    setConversations((old) => old.map((c) => c.id === activeConvId ? {...c,messages:[...c.messages,draft]} : c));
    void sendWithKey(activeConvId,text,key);
  };
  const retryMessage = (messageId: string) => {
    const pending=activeConversation?.messages.find((message) => message.id === messageId);
    if (!pending?.clientMessageId || !activeConvId) return;
    setConversations((old) => old.map((c) => c.id === activeConvId ? {...c,messages:c.messages.map((m) => m.id===messageId ? {...m,status:"sending"} : m)} : c));
    void sendWithKey(activeConvId,pending.text,pending.clientMessageId,pending.sharedPostId);
  };
  const sendSharedTrip = (postId:string) => {
    if(!activeConvId || !userId)return;
    const key=crypto.randomUUID();
    const draft:ChatMessageItem={id:`pending-${key}`,clientMessageId:key,sharedPostId:postId,
      senderId:CURRENT_USER_ID,text:t("chat.sharedTrip.shareAction"),createdAt:new Date().toISOString(),status:"sending"};
    setConversations((old)=>old.map((c)=>c.id===activeConvId?{...c,messages:[...c.messages,draft]}:c));
    void sendWithKey(activeConvId,"",key,postId);
  };
  const loadOlder = async () => {
    const cursor=activeConversation?.olderCursor;
    if(!activeConvId || !cursor || !userId)return;
    try {
      const page=await chatApi.messages(activeConvId,cursor);
      setConversations((old)=>old.map((c)=>c.id===activeConvId?{
        ...c,olderCursor:page.nextCursor,
        messages:[...page.items.slice().reverse().map((m)=>toChatMessage(m,userId)),...c.messages],
      }:c));
    } catch {
      // Silently handle pagination error
    }
  };
  const runAction = async (action: () => Promise<unknown>, after?: () => void) => {
    try { await action(); after?.(); await refresh(); }
    catch {
      // Silently handle action error
    }
  };
  const selectUser = (user: ChatUser) => {
    void runAction(async () => {
      const server=await chatApi.create(user.id);
      const mapped=toConversation(server,userId || "");
      setConversations((old) => [mapped,...old.filter((c) => c.id!==mapped.id)]);
      setActiveConvId(mapped.id);
      setActiveTab("all");
      setMobileView("thread");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("t", mapped.id);
        url.searchParams.delete("userId");
        window.history.replaceState(null, "", url.toString());
      }
    });
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-1 flex-col overflow-hidden bg-muted/30">
      <div className="flex min-h-0 flex-1 overflow-hidden p-2 sm:p-3 md:p-4 gap-2 sm:gap-3 md:gap-4">
        {isLoading ? (
          <>
            <div className="w-full md:w-[360px] lg:w-[400px] xl:w-[440px] shrink-0 bg-card border border-border/70 rounded-2xl md:rounded-3xl shadow-xs overflow-hidden">
              <ChatSidebarSkeleton />
            </div>
            <div className="hidden md:flex flex-1 min-w-0 bg-card border border-border/70 rounded-2xl md:rounded-3xl shadow-xs overflow-hidden">
              <ChatThreadSkeleton />
            </div>
          </>
        ) : (
          <>
            <ChatSidebar
              conversations={conversations}
              activeConversationId={activeConvId}
              onSelectConversation={selectConversation}
              onOpenNewChat={() => setIsNewChatOpen(true)}
              onManageBlocks={() => setBlocksOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              requestCount={requestCount}
              totalUnreadCount={totalUnreadCount}
              className={cn(
                "bg-card border border-border/70 rounded-2xl md:rounded-3xl shadow-xs overflow-hidden",
                mobileView === "thread" ? "hidden md:flex" : "flex"
              )}
            />
            <ChatThread
              conversation={activeConversation}
              onBackToList={() => setMobileView("list")}
              onSendMessage={sendMessage}
              onRetryMessage={retryMessage}
              onAcceptRequest={() => activeConvId && void runAction(() => chatApi.accept(activeConvId), () => setActiveTab("all"))}
              onDeclineRequest={() => activeConvId && void runAction(() => chatApi.decline(activeConvId), () => setMobileView("list"))}
              onBlockUser={() => activeConversation && void runAction(() => chatApi.block(activeConversation.user.id), () => setMobileView("list"))}
              onToggleMute={() => activeConversation && void runAction(() => chatApi.mute(activeConvId, !activeConversation.isMuted))}
              onReportUser={(reason) => activeConversation && void runAction(() => chatApi.report(activeConvId, activeConversation.user.id, reason))}
              onShareTrip={() => setShareTripOpen(true)}
              onLoadOlder={() => { void loadOlder(); }}
              onOpenNewChat={() => setIsNewChatOpen(true)}
              className={cn(
                "bg-card border border-border/70 rounded-2xl md:rounded-3xl shadow-xs overflow-hidden",
                mobileView === "list" ? "hidden md:flex" : "flex"
              )}
            />
          </>
        )}
      </div>
      <NewChatDialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen} onSelectUser={selectUser} currentUserId={userId || ""} />
      <ShareTripDialog open={shareTripOpen} onOpenChange={setShareTripOpen} userId={userId || ""} onSelect={sendSharedTrip} />
      <BlockedUsersDialog open={blocksOpen} onOpenChange={setBlocksOpen} onChanged={() => { void refresh(); }} />
    </div>
  );
}
