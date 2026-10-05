"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  MoreVertical,
  Bell,
  BellOff,
  ShieldAlert,
  Flag,
  MessageSquare,
  Plus,
  SquarePen,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/shared";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Conversation, ChatMessageItem } from "../types/chat.types";
import { ChatBubble } from "./chat-bubble";
import { ChatComposer } from "./chat-composer";
import { MessageRequestBanner } from "./message-request-banner";
import { CURRENT_USER_ID } from "../types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ChatThreadProps {
  conversation?: Conversation;
  onBackToList: () => void;
  onSendMessage: (text: string) => void;
  onRetryMessage: (messageId: string) => void;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
  onBlockUser: () => void;
  onToggleMute: () => void;
  onReportUser?: (reason: string) => void;
  onShareTrip?: () => void;
  onLoadOlder?: () => void;
  onOpenNewChat: () => void;
  className?: string;
}

function formatDateSeparator(dateStr: string, t: (key: string) => string): string {
  try {
    const msgDate = new Date(dateStr);
    if (isNaN(msgDate.getTime())) return dateStr;

    const today = new Date();
    const isToday =
      msgDate.getDate() === today.getDate() &&
      msgDate.getMonth() === today.getMonth() &&
      msgDate.getFullYear() === today.getFullYear();

    if (isToday) return t("chat.thread.dateSeparators.today");

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      msgDate.getDate() === yesterday.getDate() &&
      msgDate.getMonth() === yesterday.getMonth() &&
      msgDate.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return t("chat.thread.dateSeparators.yesterday");

    return msgDate.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ChatThread({
  conversation,
  onBackToList,
  onSendMessage,
  onRetryMessage,
  onAcceptRequest,
  onDeclineRequest,
  onBlockUser,
  onToggleMute,
  onReportUser,
  onShareTrip,
  onLoadOlder,
  onOpenNewChat,
  className,
}: ChatThreadProps) {
  const { t } = useTranslation();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [showBlockDialog, setShowBlockDialog] = React.useState(false);
  const [showReportDialog, setShowReportDialog] = React.useState(false);
  const [reportReason,setReportReason] = React.useState("SPAM");

  // Auto scroll to bottom when messages update
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length, conversation?.id]);

  // Group messages with date separators and group consecutive incoming messages
  const messagesWithSeparators = React.useMemo(() => {
    if (!conversation) return [];

    const items: Array<
      | { type: "separator"; date: string }
      | {
          type: "message";
          data: ChatMessageItem;
          isConsecutive: boolean;
          showAvatar: boolean;
        }
    > = [];

    let lastDateGroup = "";

    conversation.messages.forEach((msg, idx) => {
      const dateGroup = formatDateSeparator(msg.createdAt, t);
      const hasSeparator = dateGroup !== lastDateGroup;
      if (hasSeparator) {
        items.push({ type: "separator", date: dateGroup });
        lastDateGroup = dateGroup;
      }

      const prevMsg = idx > 0 ? conversation.messages[idx - 1] : null;
      const nextMsg =
        idx < conversation.messages.length - 1
          ? conversation.messages[idx + 1]
          : null;

      const nextDateGroup = nextMsg ? formatDateSeparator(nextMsg.createdAt, t) : null;
      const sameDateWithNext = nextDateGroup === dateGroup;

      const isConsecutive = !hasSeparator && prevMsg?.senderId === msg.senderId;

      // 11. Avatar rendered ONLY on the final message of an incoming group
      const isRecipient = msg.senderId !== CURRENT_USER_ID;
      const isLastInIncomingGroup =
        isRecipient &&
        (!nextMsg || !sameDateWithNext || nextMsg.senderId !== msg.senderId);

      items.push({
        type: "message",
        data: msg,
        isConsecutive,
        showAvatar: isLastInIncomingGroup,
      });
    });

    return items;
  }, [conversation?.messages, conversation, t]);

  if (!conversation) {
    return (
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center p-8 text-center bg-card select-none",
          className
        )}
      >
        <div className="p-5 sm:p-6 rounded-3xl bg-muted/70 text-muted-foreground mb-5">
          <MessageSquare className="h-12 w-12 sm:h-14 sm:w-14 text-primary/70" />
        </div>
        <h3 className="font-bold text-2xl sm:text-3xl text-foreground mb-3 tracking-tight">
          {t("chat.empty.noActiveChatTitle")}
        </h3>
        <p className="text-base sm:text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
          {t("chat.empty.noActiveChatDesc")}
        </p>
        <Button
          onClick={onOpenNewChat}
          className="h-11 px-6 sm:h-12 sm:px-7 rounded-full font-bold text-sm sm:text-base gap-2.5 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
        >
          <SquarePen className="h-5 w-5" />
          <span>{t("chat.dialogs.newChat.title")}</span>
        </Button>
      </div>
    );
  }

  return (
    <section
      className={cn("flex-1 flex flex-col h-full bg-card relative overflow-hidden", className)}
      aria-label={t("chat.thread.conversationAria", { name: conversation.user.name })}
    >
      {/* 6. Thread Header */}
      <header className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-border/40 bg-card flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Back button on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onBackToList}
            className="md:hidden h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full hover:bg-muted"
            aria-label={t("chat.thread.backToList")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Recipient Avatar with semantic online token */}
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 sm:h-13 sm:w-13 border border-border/70">
              <AvatarImage src={conversation.user.avatar} alt={conversation.user.name} />
              <AvatarFallback className="text-base font-bold bg-muted text-foreground">
                {conversation.user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {conversation.user.isOnline && (
              <span
                className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-emerald-500 ring-2.5 ring-card"
                title={t("chat.status.activeNow")}
              />
            )}
          </div>

          {/* Name & status */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-foreground truncate tracking-tight">
                {conversation.user.name}
              </h3>
              {conversation.isMuted && (
                <span title={t("chat.status.muted")}>
                  <BellOff className="h-4 w-4 text-muted-foreground/70" />
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate font-medium">
              {conversation.user.statusText ||
                (conversation.user.isOnline
                  ? t("chat.status.activeNow")
                  : t("chat.status.offline"))}
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Target specific user profile instead of generic /profile */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="px-4 text-sm font-semibold text-muted-foreground hover:text-foreground hidden sm:inline-flex gap-2 rounded-full h-10 hover:bg-muted"
          >
            <Link href={`/community/users/${conversation.user.id}`}>
              <User className="h-4.5 w-4.5" />
              <span>{t("chat.thread.viewProfile")}</span>
            </Link>
          </Button>

          {/* 3-dots Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                aria-label={t("chat.thread.conversationActions")}
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-md border-border">
              <DropdownMenuItem onClick={onToggleMute} className="gap-2 text-control">
                {conversation.isMuted ? (
                  <>
                    <Bell className="h-4 w-4" />
                    <span>{t("chat.thread.unmuteNotifications")}</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4" />
                    <span>{t("chat.thread.muteNotifications")}</span>
                  </>
                )}
              </DropdownMenuItem>

              <DropdownMenuItem asChild className="gap-2 text-control sm:hidden">
                <Link href={`/community/users/${conversation.user.id}`}>
                  <User className="h-4 w-4" />
                  <span>{t("chat.thread.viewProfile")}</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setShowReportDialog(true)}
                className="gap-2 text-control text-muted-foreground hover:text-foreground"
              >
                <Flag className="h-4 w-4" />
                <span>{t("chat.thread.reportUser")}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setShowBlockDialog(true)}
                className="gap-2 text-control text-destructive hover:bg-destructive/10 focus:text-destructive"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>{t("chat.thread.blockUser")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 11. Message Request Banner (if pending request) */}
      {conversation.isRequest && (
        <MessageRequestBanner
          user={conversation.user}
          onAccept={onAcceptRequest}
          onDecline={onDeclineRequest}
          onBlock={() => setShowBlockDialog(true)}
        />
      )}

      {/* 3. Centered message stream inside max-w-4xl container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-4xl mx-auto w-full space-y-0.5">
          {conversation.olderCursor && onLoadOlder && <div className="flex justify-center pb-3">
            <Button variant="ghost" size="sm" onClick={onLoadOlder}>{t("chat.thread.loadOlder")}</Button>
          </div>}
          {messagesWithSeparators.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8 text-center text-caption text-muted-foreground">
              {t("chat.thread.emptyThread")}
            </div>
          ) : (
            messagesWithSeparators.map((item, idx) => {
              if (item.type === "separator") {
                return (
                  <div key={`sep-${idx}`} className="flex justify-center my-4 select-none">
                    <span className="text-xs font-semibold text-muted-foreground bg-muted/80 px-3.5 py-1 rounded-full shadow-2xs">
                      {item.date}
                    </span>
                  </div>
                );
              }

              return (
                <ChatBubble
                  key={item.data.id}
                  message={item.data}
                  recipientUser={conversation.user}
                  onRetry={onRetryMessage}
                  isConsecutive={item.isConsecutive}
                  showAvatar={item.showAvatar}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 4. Compact Sticky Bottom Composer aligned to max-w-4xl */}
      <ChatComposer
        onSendMessage={onSendMessage}
        onShareTrip={onShareTrip}
        disabled={conversation.isRequest || conversation.state === "PENDING" || conversation.state === "DECLINED"}
        disabledPlaceholder={t("chat.composer.requestLockedPlaceholder")}
      />

      {/* Block Confirmation Dialog */}
      <ConfirmationDialog
        open={showBlockDialog}
        onOpenChange={setShowBlockDialog}
        title={t("chat.dialogs.blockConfirm.title")}
        description={t("chat.dialogs.blockConfirm.description", {
          name: conversation.user.name,
        })}
        confirmText={t("chat.dialogs.blockConfirm.confirm")}
        cancelText={t("chat.dialogs.blockConfirm.cancel")}
        variant="destructive"
        onConfirm={onBlockUser}
      />

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t("chat.dialogs.reportConfirm.title")}</DialogTitle>
            <DialogDescription>{t("chat.dialogs.reportConfirm.description",{name:conversation.user.name})}</DialogDescription></DialogHeader>
          <label className="grid gap-2 text-sm font-medium" htmlFor="chat-report-reason">
            {t("chat.dialogs.reportConfirm.reasonLabel")}
            <select id="chat-report-reason" value={reportReason} onChange={(event)=>setReportReason(event.target.value)}
              className="h-11 rounded-lg border border-border bg-background px-3">
              {["SPAM","HARASSMENT","DANGEROUS_CONTENT","PRIVACY","OTHER"].map((reason)=><option key={reason} value={reason}>
                {t(`chat.dialogs.reportConfirm.reasons.${reason}`)}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setShowReportDialog(false)}>{t("chat.dialogs.reportConfirm.cancel")}</Button>
            <Button onClick={()=>{onReportUser?.(reportReason);setShowReportDialog(false);}}>{t("chat.dialogs.reportConfirm.confirm")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
