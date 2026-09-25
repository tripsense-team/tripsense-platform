// TripSense Firebase Cloud Messaging Service Worker
/* eslint-disable no-undef */

const params = new URL(location).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "AIzaSyB9vsNeTdGAEugmXs78BDc_id7Ad7A5OOA",
  authDomain: params.get("authDomain") || "tripsense-642bd.firebaseapp.com",
  projectId: params.get("projectId") || "tripsense-642bd",
  storageBucket: params.get("storageBucket") || "tripsense-642bd.firebasestorage.app",
  messagingSenderId: params.get("messagingSenderId") || "416102507883",
  appId: params.get("appId") || "1:416102507883:web:2bee46b95a96120c16d82e",
};

try {
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle = payload.notification?.title || payload.data?.title || "TripSense";
      const clickActionUrl = payload.data?.clickActionUrl || (payload.data?.conversationId ? `/chat?t=${payload.data.conversationId}` : "/chat");
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || "Bạn có tin nhắn mới",
        icon: "/globe.svg",
        badge: "/globe.svg",
        data: {
          ...payload.data,
          clickActionUrl,
        },
        tag: payload.data?.conversationId ? `chat-${payload.data.conversationId}` : `chat-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  // If compat scripts fail to load, fallback to native push listener below
}

// Fallback native push event listener
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const notification = payload.notification || {};
    const data = payload.data || {};

    const title = notification.title || data.title || "TripSense";
    const body = notification.body || data.body || "Bạn có tin nhắn mới";
    const clickActionUrl = data.clickActionUrl || (data.conversationId ? `/chat?t=${data.conversationId}` : "/chat");

    const options = {
      body: body,
      icon: "/globe.svg",
      badge: "/globe.svg",
      data: {
        ...data,
        clickActionUrl,
      },
      tag: data.conversationId ? `chat-${data.conversationId}` : `chat-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification("TripSense", {
        body: text || "Bạn có tin nhắn mới",
        icon: "/globe.svg",
        requireInteraction: true,
      })
    );
  }
});

// Điều hướng vào đúng cuộc trò chuyện khi click vào thông báo
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const conversationId = event.notification.data?.conversationId;
  const clickActionUrl = event.notification.data?.clickActionUrl;
  const targetUrl = clickActionUrl || (conversationId ? `/chat?t=${conversationId}` : "/chat");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/chat") && "focus" in client) {
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
