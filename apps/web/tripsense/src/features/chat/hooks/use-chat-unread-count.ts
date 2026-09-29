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

let lastFetchTime = 0;
const FOCUS_THROTTLE_MS = 30000; // 30 seconds cooldown between background focus refetches

export const useChatUnreadStore = create<ChatUnreadState>((set, get) => ({
  unreadConversationsCount: 0,
  totalUnreadMessages: 0,
  isLoading: false,

  setUnreadCount: (count: number) => {
    const safeCount = Math.max(0, count);
    if (get().unreadConversationsCount !== safeCount) {
      set({ unreadConversationsCount: safeCount });
      updateBrowserTabTitle(safeCount);
    }
  },

  decrementUnreadCount: () => {
    const current = get().unreadConversationsCount;
    const next = Math.max(0, current - 1);
    if (current !== next) {
      set({ unreadConversationsCount: next });
      updateBrowserTabTitle(next);
    }
  },

  fetchUnreadSummary: async () => {
    const now = Date.now();
    if (now - lastFetchTime < FOCUS_THROTTLE_MS) {
      return;
    }
    lastFetchTime = now;

    try {
      const summary = await chatApi.unreadSummary();
      const count = summary.unreadConversationsCount ?? 0;
      const total = summary.totalUnreadMessages ?? 0;
      const current = get();

      // Only mutate state if count or total actually changed!
      // This prevents triggering unnecessary component re-renders across the app.
      if (
        current.unreadConversationsCount !== count ||
        current.totalUnreadMessages !== total
      ) {
        set({
          unreadConversationsCount: count,
          totalUnreadMessages: total,
          isLoading: false,
        });
        updateBrowserTabTitle(count);
      }
    } catch {
      // Silently ignore background unread fetch failure
    }
  },

  reset: () => {
    lastFetchTime = 0;
    const current = get();
    if (current.unreadConversationsCount !== 0 || current.totalUnreadMessages !== 0) {
      set({ unreadConversationsCount: 0, totalUnreadMessages: 0, isLoading: false });
    }
    updateBrowserTabTitle(0);
  },
}));

export function useChatUnreadCount() {
  const unreadConversationsCount = useChatUnreadStore(
    (s) => s.unreadConversationsCount,
  );
  const totalUnreadMessages = useChatUnreadStore((s) => s.totalUnreadMessages);
  const decrementUnreadCount = useChatUnreadStore((s) => s.decrementUnreadCount);
  const setUnreadCount = useChatUnreadStore((s) => s.setUnreadCount);
  const fetchUnreadSummary = useChatUnreadStore((s) => s.fetchUnreadSummary);
  const reset = useChatUnreadStore((s) => s.reset);

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
      lastFetchTime = 0; // Bypass throttle on explicit notification event
      void fetchUnreadSummary();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadSummary();
      }
    };

    window.addEventListener("chat:unread-changed", handleCustomEvent);
    document.addEventListener("visibilitychange", handleVisibility);

    // Background poll fallback every 60 seconds
    timerRef.current = window.setInterval(() => {
      void fetchUnreadSummary();
    }, 60000);

    return () => {
      window.removeEventListener("chat:unread-changed", handleCustomEvent);
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
