"use client";

import { create } from "zustand";
import { useEffect, useRef } from "react";
import { chatApi } from "../services/chat-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

interface ChatUnreadState {
  unreadConversationsCount: number;
  totalUnreadMessages: number;
  isLoading: boolean;
  setUnreadCount: (count: number) => void;
  decrementUnreadCount: () => void;
  fetchUnreadSummary: () => Promise<void>;
  reset: () => void;
}

const updateBrowserTabTitle = (count: number) => {
  if (typeof document === "undefined") return;
  const currentTitle = document.title.replace(/^\(\d+\)\s*/, "");
  if (count > 0) {
    document.title = `(${count}) ${currentTitle}`;
  } else {
    document.title = currentTitle;
  }
};

export const useChatUnreadStore = create<ChatUnreadState>((set, get) => ({
  unreadConversationsCount: 0,
  totalUnreadMessages: 0,
  isLoading: false,

  setUnreadCount: (count: number) => {
    const safeCount = Math.max(0, count);
    set({ unreadConversationsCount: safeCount });
    updateBrowserTabTitle(safeCount);
  },

  decrementUnreadCount: () => {
    const current = get().unreadConversationsCount;
    const next = Math.max(0, current - 1);
    set({ unreadConversationsCount: next });
    updateBrowserTabTitle(next);
  },

  fetchUnreadSummary: async () => {
    try {
      set({ isLoading: true });
      const summary = await chatApi.unreadSummary();
      const count = summary.unreadConversationsCount ?? 0;
      set({
        unreadConversationsCount: count,
        totalUnreadMessages: summary.totalUnreadMessages ?? 0,
        isLoading: false,
      });
      updateBrowserTabTitle(count);
    } catch {
      set({ isLoading: false });
    }
  },

  reset: () => {
    set({ unreadConversationsCount: 0, totalUnreadMessages: 0, isLoading: false });
    updateBrowserTabTitle(0);
  },
}));

export function useChatUnreadCount() {
  const {
    unreadConversationsCount,
    totalUnreadMessages,
    decrementUnreadCount,
    setUnreadCount,
    fetchUnreadSummary,
    reset,
  } = useChatUnreadStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authVersion = useAuthStore((s) => s.authVersion);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }

    void fetchUnreadSummary();

    const handleCustomEvent = () => {
      void fetchUnreadSummary();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadSummary();
      }
    };

    window.addEventListener("chat:unread-changed", handleCustomEvent);
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    // Background poll fallback every 45 seconds
    timerRef.current = window.setInterval(() => {
      void fetchUnreadSummary();
    }, 45000);

    return () => {
      window.removeEventListener("chat:unread-changed", handleCustomEvent);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isAuthenticated, authVersion, fetchUnreadSummary, reset]);

  return {
    unreadConversationsCount,
    totalUnreadMessages,
    decrementUnreadCount,
    setUnreadCount,
    refetch: fetchUnreadSummary,
  };
}
