"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useMessages } from "@/hooks/use-messages";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import type {
  OpenPlaceDetailTarget,
  PlaceMentionTarget,
} from "./chat-place-resolver";
import { PlaceDetailActionProvider } from "./place-detail-action-context";

type MessagesProps = {
  chatId?: string;
  activeTrip?: { id: string; name: string } | null;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages?: (messages: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])) => void;
  regenerate?: (options?: { messageId?: string } & Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
  onEditMessage?: (message: ChatMessage) => void;
  onQuickReply?: (prompt: string) => void;
  onOpenPlaceDetail?: (target: OpenPlaceDetailTarget) => void;
  placeMentionTargets?: ReadonlyArray<PlaceMentionTarget>;
  excludedPlaceNames?: ReadonlyArray<string>;
};

export function Messages({
  chatId,
  activeTrip,
  status,
  messages,
  setMessages,
  regenerate,
  isLoading,
  onEditMessage,
  onQuickReply,
  onOpenPlaceDetail,
  placeMentionTargets,
  excludedPlaceNames,
}: MessagesProps) {
  const { t } = useTranslation();
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    reset,
  } = useMessages({
    status,
  });

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return (
    <PlaceDetailActionProvider
      openPlaceDetail={onOpenPlaceDetail}
      placeMentionTargets={placeMentionTargets}
      excludedPlaceNames={excludedPlaceNames}
    >
      <div className="relative flex-1 bg-background overflow-hidden">
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}
      {messages.length === 0 && isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground animate-pulse font-medium">
              {t("aiPlanner.loadingHistory")}
            </span>
          </div>
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 touch-pan-y overflow-y-auto",
          messages.length > 0 ? "bg-background" : "bg-transparent"
        )}
        ref={messagesContainerRef}
      >
        <div className="mx-auto flex min-h-full min-w-0 max-w-4xl flex-col gap-5 px-2 py-6 md:gap-7 md:px-4">
          {messages.map((message, index) => (
            <PreviewMessage
              activeTrip={activeTrip}
              chatId={chatId}
              isLoading={
                (status === "streaming" || status === "submitted") &&
                messages.length - 1 === index
              }
              key={message.id}
              message={message}
              onEdit={onEditMessage}
              onQuickReply={onQuickReply}
              regenerate={regenerate}
              setMessages={setMessages}
              showRefinementChips={
                status === "ready" && !isLoading && index === messages.length - 1
              }
            />
          ))}

          {(status === "submitted" || status === "streaming") &&
            messages.at(-1)?.role === "user" && <ThinkingMessage />}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </div>
      </div>

      <button
        aria-label="Scroll to bottom"
        className={`absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full border border-border/50 bg-card/90 px-3.5 shadow-[var(--shadow-float)] backdrop-blur-lg transition-all duration-200 h-7 text-micro ${
          isAtBottom
            ? "pointer-events-none scale-90 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={handleScrollToBottom}
        type="button"
      >
        <ArrowDownIcon className="size-3 text-muted-foreground" />
      </button>
      </div>
    </PlaceDetailActionProvider>
  );
}
