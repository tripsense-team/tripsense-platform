import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "tripsense-642bd.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tripsense-642bd",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "tripsense-642bd.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "416102507883",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:416102507883:web:2bee46b95a96120c16d82e",
};

export const VAPID_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
  "BOAADDGPBCDwIPOi-0XYh2EnRknNGpfHYahftBsa5B4y5bslvaiCdrLiqu8yCe8Mh8gGEQD7Xb79l1KFiyBhXmw";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (!messaging) {
    const fbApp = getFirebaseApp();
    if (fbApp) {
      messaging = getMessaging(fbApp);
    }
  }
  return messaging;
}

export async function requestFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[FCM] Trình duyệt không hỗ trợ Web Notification hoặc Service Worker.");
    return null;
  }

  if (!firebaseConfig.apiKey) {
    console.warn(
      "[FCM] ⚠️ Thiếu NEXT_PUBLIC_FIREBASE_API_KEY trong file .env! Firebase Web SDK yêu cầu API Key để tạo token push.",
    );
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Quyền thông báo trình duyệt hiện tại:", permission);
      return null;
    }

    const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(firebaseConfig.apiKey)}&projectId=${encodeURIComponent(firebaseConfig.projectId)}&messagingSenderId=${encodeURIComponent(firebaseConfig.messagingSenderId)}&appId=${encodeURIComponent(firebaseConfig.appId)}`;
    const swRegistration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const msg = await getFirebaseMessaging();
    if (!msg) {
      console.warn("[FCM] Không thể khởi tạo Firebase Messaging instance.");
      return null;
    }

    const currentToken = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (currentToken) {
      console.info("[FCM] ✅ Đã lấy FCM Token thành công:", currentToken.substring(0, 15) + "...");
    } else {
      console.warn("[FCM] Không nhận được token từ Firebase (null).");
    }

    return currentToken || null;
  } catch (error) {
    console.error("[FCM] ❌ Lỗi khi tạo FCM Token từ Firebase:", error);
    return null;
  }
}

export async function setupForegroundMessageListener(onNotification?: (payload: unknown) => void): Promise<(() => void) | null> {
  if (typeof window === "undefined") return null;
  try {
    const msg = await getFirebaseMessaging();
    if (!msg) return null;

    const unsubscribe = onMessage(msg, (payload) => {
      console.info("[FCM] 📩 Nhận thông báo Foreground:", payload);
      window.dispatchEvent(new CustomEvent("chat:unread-changed"));

      const data = (payload.data || {}) as Record<string, string | undefined>;
      const notification = payload.notification || {};
      const title = notification.title || data.title || "TripSense";
      const body = notification.body || data.body || "Bạn có tin nhắn mới";
      const clickActionUrl = data.clickActionUrl || (data.conversationId ? `/chat?t=${data.conversationId}` : "/chat");

      // 1. Dispatch in-app notification event for banner UI
      console.info("[FCM] 🔔 Đang hiển thị thông báo:", { title, body, clickActionUrl, permission: typeof Notification !== "undefined" ? Notification.permission : "N/A" });
      window.dispatchEvent(
        new CustomEvent("chat:notification-toast", {
          detail: { title, body, clickActionUrl, conversationId: data.conversationId },
        })
      );

      // 2. Display OS desktop notification via Service Worker (Persistent Notification API for macOS)
      if ("serviceWorker" in navigator && "Notification" in window) {
        if (Notification.permission === "granted") {
          navigator.serviceWorker.ready
            .then((reg) => {
              return reg.showNotification(title, {
                body,
                icon: "/globe.svg",
                badge: "/globe.svg",
                tag: data.conversationId ? `chat-${data.conversationId}` : `fcm-${Date.now()}`,
                data: { clickActionUrl },
                requireInteraction: true,
              });
            })
            .catch((err) => {
              console.warn("[FCM] reg.showNotification lỗi:", err);
              try {
                new Notification(title, { body, icon: "/globe.svg" });
              } catch {}
            });
        } else {
          console.warn("[FCM] ⚠️ Quyền thông báo trình duyệt hiện tại:", Notification.permission);
        }
      }

      if (onNotification) {
        onNotification(payload);
      }
    });

    return unsubscribe;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__checkFcmStatus = async () => {
    console.group("🔍 [TripSense] Kiểm tra cấu hình Firebase Cloud Messaging");
    console.log("1. Quyền thông báo (Notification.permission):", "Notification" in window ? Notification.permission : "N/A");
    console.log("2. Service Worker hỗ trợ:", "serviceWorker" in navigator ? "Có" : "Không");
    console.log("3. Project ID:", firebaseConfig.projectId);
    console.log("4. API Key:", firebaseConfig.apiKey ? "✅ Đã cấu hình" : "❌ CHƯA CÓ (NEXT_PUBLIC_FIREBASE_API_KEY)");
    console.log("5. App ID:", firebaseConfig.appId ? "✅ Đã cấu hình" : "❌ CHƯA CÓ (NEXT_PUBLIC_FIREBASE_APP_ID)");
    console.log("6. VAPID Key:", VAPID_KEY ? "✅ Đã cấu hình" : "❌ CHƯA CÓ");
    console.groupEnd();
  };
}

