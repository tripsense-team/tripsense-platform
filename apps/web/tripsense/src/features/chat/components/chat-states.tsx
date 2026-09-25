"use client";

import * as React from "react";
import { MessageSquare, SearchX, WifiOff, AlertCircle, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";

export function ChatSidebarSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="p-3 space-y-3" role="status" aria-label={t("chat.sidebar.loadingAria")}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatThreadSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col h-full p-4 space-y-4" role="status" aria-label={t("chat.thread.loadingAria")}>
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex-1 space-y-4 py-4">
        <div className="flex items-end gap-2 max-w-[70%]">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-12 w-48 rounded-2xl" />
        </div>
        <div className="flex items-end gap-2 max-w-[70%] ml-auto justify-end">
          <Skeleton className="h-16 w-56 rounded-2xl" />
        </div>
        <div className="flex items-end gap-2 max-w-[70%]">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-20 w-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator({ onReconnect }: { onReconnect?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 text-destructive text-xs py-1.5 px-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>{t("chat.offline.banner")}</span>
      </div>
      {onReconnect && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onReconnect}
          className="text-micro px-2 text-destructive hover:bg-destructive/10"
        >
          {t("chat.offline.toggleBackOnline")}
        </Button>
      )}
    </div>
  );
}

export function EmptyInboxState({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center my-auto">
      <div className="p-4 sm:p-5 rounded-3xl bg-muted/70 text-muted-foreground mb-4">
        <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-primary/70" />
      </div>
      <h3 className="font-bold text-lg sm:text-xl text-foreground mb-2 tracking-tight">
        {t("chat.empty.noConversationsTitle")}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground max-w-xs mb-6 leading-relaxed">
        {t("chat.empty.noConversationsDesc")}
      </p>
      <Button
        size="default"
        onClick={onNewChat}
        className="h-10 px-5 rounded-full gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-all active:scale-95"
      >
        <Plus className="h-4 w-4" />
        <span>{t("chat.dialogs.newChat.title")}</span>
      </Button>
    </div>
  );
}

export function EmptySearchState({ query }: { query: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center my-auto">
      <div className="p-3.5 rounded-2xl bg-muted/70 text-muted-foreground mb-3">
        <SearchX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-bold text-base sm:text-lg text-foreground mb-1.5">
        {t("chat.empty.noSearchResultsTitle")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-normal">
        {t("chat.empty.noSearchResultsDesc", { query })}
      </p>
    </div>
  );
}

export function ChatErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center m-auto rounded-2xl border border-destructive/20 bg-destructive/5 text-card-foreground max-w-md">
      <div className="p-4 rounded-2xl bg-destructive/10 text-destructive mb-3.5">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="font-bold text-lg text-foreground mb-1.5">
        {t("chat.errors.loadErrorTitle")}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5 leading-normal">
        {t("chat.errors.loadErrorDesc")}
      </p>
      <Button
        variant="outline"
        size="default"
        onClick={onRetry}
        className="rounded-full h-10 px-5 text-sm font-semibold border-border/80"
      >
        {t("chat.actions.retry")}
      </Button>
    </div>
  );
}
