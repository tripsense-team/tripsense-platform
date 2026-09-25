"use client";

import * as React from "react";
import { Search, UserPlus, SquarePen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatUser } from "../types/chat.types";
import { chatApi, DEFAULT_SUGGESTED_USERS, removeDiacritics } from "../services/chat-api";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

export interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectUser: (user: ChatUser) => void;
  currentUserId?: string;
}

export function NewChatDialog({
  open,
  onOpenChange,
  onSelectUser,
  currentUserId,
}: NewChatDialogProps) {
  const { t } = useTranslation();
  const authUser = useAuthStore((s) => s.user);
  const activeUserId = currentUserId || authUser?.id || "";

  const availableSuggestions = React.useMemo(() => {
    return DEFAULT_SUGGESTED_USERS.filter((u) => u.id !== activeUserId);
  }, [activeUserId]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [users, setUsers] = React.useState<ChatUser[]>(availableSuggestions);
  const [searchFailed, setSearchFailed] = React.useState(false);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setUsers(availableSuggestions);
      setSearching(false);
      setSearchFailed(false);
      return;
    }

    const normalized = removeDiacritics(trimmed);
    const localMatches = availableSuggestions.filter((u) =>
      removeDiacritics(u.name).includes(normalized)
    );

    // Provide instant local feedback
    setUsers(localMatches);
    setSearchFailed(false);

    let canceled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void chatApi
        .search(trimmed)
        .then((rows) => {
          if (!canceled) {
            const mapped: ChatUser[] = rows
              .filter((row) => row.userId !== activeUserId)
              .map((row) => {
                const existing = availableSuggestions.find((s) => s.id === row.userId);
                return {
                  id: row.userId,
                  name: row.displayName,
                  avatar: row.avatarUrl || existing?.avatar || undefined,
                  isOnline: existing?.isOnline ?? true,
                  statusText: existing?.statusText,
                };
              });

            const seen = new Set<string>();
            const combined: ChatUser[] = [];
            for (const item of [...mapped, ...localMatches]) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
            setUsers(combined);
            setSearchFailed(false);
          }
        })
        .catch(() => {
          if (!canceled) {
            if (localMatches.length === 0) {
              setSearchFailed(true);
            }
          }
        })
        .finally(() => {
          if (!canceled) setSearching(false);
        });
    }, 200);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [open, searchQuery, availableSuggestions, activeUserId]);

  // Reset search and show suggestions when opened
  React.useEffect(() => {
    if (open) {
      setSearchQuery("");
      setUsers(availableSuggestions);
      setSearchFailed(false);
      setSearching(false);
    }
  }, [open, availableSuggestions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden bg-card border border-border/70 shadow-xl">
        <DialogHeader className="p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <SquarePen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                {t("chat.dialogs.newChat.title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t("chat.dialogs.newChat.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 pb-3">
          {/* Search Input - Display name only! */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("chat.dialogs.newChat.placeholder")}
              aria-label={t("chat.dialogs.newChat.placeholder")}
              className="pl-10 pr-9 bg-muted/50 hover:bg-muted/70 focus-visible:bg-card border-none rounded-full text-sm h-11 shadow-none transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={t("common.clear")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="max-h-80 overflow-y-auto px-4 pb-4 space-y-1">
          <div className="px-2 py-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t("chat.dialogs.newChat.recentTitle")}
          </div>

          {searchFailed && users.length === 0 ? (
            <div role="alert" className="py-8 text-center text-sm text-destructive">
              {t("chat.errors.searchFailed")}
            </div>
          ) : searching && users.length === 0 ? (
            <div role="status" className="py-8 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>{t("chat.sidebar.loadingAria")}</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery.trim().length === 0
                ? t("chat.dialogs.newChat.minimumQuery")
                : t("chat.dialogs.newChat.empty", { query: searchQuery })}
            </div>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  onSelectUser(user);
                  onOpenChange(false);
                }}
                className="w-full p-2.5 sm:p-3 rounded-2xl flex items-center justify-between text-left hover:bg-muted/70 transition-colors group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11 border border-border/70">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="text-sm font-bold bg-muted text-foreground">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {user.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {/* ONLY display name! Never email! */}
                    <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {user.name}
                    </h4>
                    {user.statusText && (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.statusText}
                      </p>
                    )}
                  </div>
                </div>

                <span className="inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold text-primary bg-primary/10 transition-all group-hover:bg-primary group-hover:text-primary-foreground shrink-0 ml-2">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline ml-1.5">{t("chat.messages")}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
