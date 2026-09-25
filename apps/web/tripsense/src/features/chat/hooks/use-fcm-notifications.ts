"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { requestFcmToken, setupForegroundMessageListener } from "@/lib/firebase";
import { chatApi } from "../services/chat-api";

const FCM_TOKEN_STORAGE_KEY = "tripsense_fcm_token";
let globalSyncPromise: Promise<string | null> | null = null;

export function useFcmNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const registeredTokenRef = useRef<string | null>(null);

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });

  const syncToken = useCallback(async () => {
    if (globalSyncPromise) {
      return globalSyncPromise;
    }

    globalSyncPromise = (async () => {
      try {
        const token = await requestFcmToken();
        if (!token) return null;

        const storedToken =
          typeof window !== "undefined"
            ? localStorage.getItem(FCM_TOKEN_STORAGE_KEY)
            : null;

        if (token !== storedToken || registeredTokenRef.current !== token) {
          await chatApi.registerFcmToken(token);
          console.info("[FCM] ✅ Đã lưu FCM Token lên cơ sở dữ liệu chat!");
          if (typeof window !== "undefined") {
            localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
          }
          registeredTokenRef.current = token;
        }
        return token;
      } catch (err) {
        console.warn("[FCM] Lỗi khi gửi token lên server:", err);
        return null;
      } finally {
        globalSyncPromise = null;
      }
    })();

    return globalSyncPromise;
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return null;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        return await syncToken();
      }
      return null;
    } catch {
      return null;
    }
  }, [syncToken]);

  const sendTestNotification = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission !== "granted") {
      const token = await requestPermission();
      if (!token) return;
    }

    try {
      // 1. Trigger real server push notification via FCM
      await chatApi.testPushNotification().catch(() => {});

      // 2. Also trigger local browser notification for immediate verification
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("TripSense", {
          body: "🔔 Thông báo đẩy thử nghiệm hoạt động tốt!",
          icon: "/globe.svg",
          badge: "/globe.svg",
          tag: "chat-test-notification",
          data: { clickActionUrl: "/chat" },
        });
      } else {
        new Notification("TripSense", {
          body: "🔔 Thông báo đẩy thử nghiệm hoạt động tốt!",
          icon: "/globe.svg",
        });
      }
    } catch {
      // Fallback
    }
  }, [requestPermission]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }

    if (!isAuthenticated || !user) {
      return;
    }

    let isMounted = true;
    let unsubscribeForeground: (() => void) | null = null;

    async function initFcm() {
      // If permission is already granted, silently sync token & register listener
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const token = await syncToken();
        if (!isMounted || !token) return;
      }

      const unsub = await setupForegroundMessageListener();
      if (isMounted) {
        unsubscribeForeground = unsub;
      } else if (unsub) {
        unsub();
      }
    }

    void initFcm();

    return () => {
      isMounted = false;
      if (unsubscribeForeground) {
        unsubscribeForeground();
      }
    };
  }, [isAuthenticated, user?.id, syncToken]);

  return {
    permission,
    requestPermission,
    sendTestNotification,
    unregisterDevice: revokeFcmTokenOnLogout,
  };
}

export async function revokeFcmTokenOnLogout(): Promise<void> {
  try {
    const storedToken =
      typeof window !== "undefined"
        ? localStorage.getItem(FCM_TOKEN_STORAGE_KEY)
        : null;
    if (storedToken) {
      await chatApi.unregisterFcmToken(storedToken).catch(() => {});
      if (typeof window !== "undefined") {
        localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore cleanup error on logout
  }
}
