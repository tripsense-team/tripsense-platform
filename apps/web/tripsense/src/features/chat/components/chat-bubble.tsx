"use client";

import * as React from "react";
import { Check, CheckCheck, Loader2, AlertCircle, RotateCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChatMessageItem, ChatUser } from "../types/chat.types";
import { SharedTripCard } from "./shared-trip-card";
import { CURRENT_USER_ID } from "../types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ChatBubbleProps {
  message: ChatMessageItem;
  recipientUser: ChatUser;
  onRetry?: (messageId: string) => void;
  showAvatar?: boolean;
  isConsecutive?: boolean;
}

export function ChatBubble({
  message,
  recipientUser,
  onRetry,
  showAvatar = true,
  isConsecutive = false,
}: ChatBubbleProps) {
  const { t } = useTranslation();
  const isMe = message.senderId === CURRENT_USER_ID;

  // Format timestamp (e.g. 10:45)
  const formattedTime = React.useMemo(() => {
    try {
      const date = new Date(message.createdAt);
      if (isNaN(date.getTime())) return message.createdAt;
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return message.createdAt;
    }
  }, [message.createdAt]);

  const renderStatus = () => {
    if (!isMe) return null;

    switch (message.status) {
      case "sending":
        return (
          <span className="flex items-center gap-1 text-micro text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
            <span>{t("chat.status.sending")}</span>
          </span>
        );
      case "sent":
        return (
          <span className="flex items-center gap-0.5 text-micro text-muted-foreground" title={t("chat.status.sent")}>
            <Check className="h-3 w-3 text-muted-foreground" aria-label={t("chat.status.sent")} />
          </span>
        );
      case "delivered":
        return <span className="flex items-center text-micro text-muted-foreground" title={t("chat.status.delivered")}>
          <CheckCheck className="h-3 w-3" aria-label={t("chat.status.delivered")} />
        </span>;
      case "read":
        return (
          <span className="flex items-center gap-0.5 text-micro text-primary" title={t("chat.status.read")}>
            <CheckCheck className="h-3 w-3 text-primary" aria-label={t("chat.status.read")} />
          </span>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1.5 text-xs text-destructive mt-0.5">
            <span className="flex items-center gap-1 font-semibold text-xs">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("chat.status.failed")}</span>
            </span>
            {onRetry && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onRetry(message.id)}
                className="h-7 px-2.5 text-xs text-destructive hover:bg-destructive/10 gap-1 rounded-full font-bold"
              >
                <RotateCw className="h-3 w-3" />
                <span>{t("chat.actions.retry")}</span>
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2.5 group transition-all",
        isConsecutive ? "my-0.5" : "mt-2.5 mb-0.5",
        isMe
          ? "ml-auto flex-row-reverse max-w-[560px]"
          : "mr-auto max-w-[560px]"
      )}
    >
      {/* Recipient Avatar: rendered only on the final message of an incoming group */}
      {!isMe && (
        <div className="w-9 shrink-0 flex justify-center">
          {showAvatar ? (
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={recipientUser.avatar} alt={recipientUser.name} />
              <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                {recipientUser.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-9" />
          )}
        </div>
      )}

      <div className={cn("space-y-1 flex flex-col", isMe ? "items-end" : "items-start")}>
        {/* Shared Trip Card Preview */}
        {message.sharedTrip && (
          <SharedTripCard trip={message.sharedTrip} className="mb-1" />
        )}

        {/* Text Message Bubble */}
        {message.text && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3 text-[15px] sm:text-base leading-relaxed shadow-2xs whitespace-pre-wrap break-words",
              isMe
                ? cn(
                    "bg-primary text-primary-foreground font-normal rounded-br-xs",
                    message.status === "failed" && "border border-destructive/40 bg-primary/95"
                  )
                : "bg-card border border-border/70 text-foreground font-normal rounded-bl-xs"
            )}
          >
            {message.text}
          </div>
        )}

        {/* Timestamp & Status Indicator (quiet styling) */}
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs sm:text-[13px] text-muted-foreground/80 px-1 select-none font-medium",
            isMe ? "justify-end" : "justify-start"
          )}
        >
          <span>{formattedTime}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
