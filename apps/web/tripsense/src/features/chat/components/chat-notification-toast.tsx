"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastData {
  id: string;
  title: string;
  body: string;
  clickActionUrl: string;
}

export function ChatNotificationToast() {
  const router = useRouter();
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  React.useEffect(() => {
    function handleToast(e: Event) {
      const customEvent = e as CustomEvent<{
        title?: string;
        body?: string;
        clickActionUrl?: string;
        conversationId?: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      const newToast: ToastData = {
        id: Math.random().toString(36).slice(2, 9),
        title: detail.title || "TripSense",
        body: detail.body || "Bạn có tin nhắn mới",
        clickActionUrl:
          detail.clickActionUrl ||
          (detail.conversationId ? `/chat?t=${detail.conversationId}` : "/chat"),
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 3));

      // Auto dismiss after 7 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 7000);
    }

    window.addEventListener("chat:notification-toast", handleToast);
    return () => {
      window.removeEventListener("chat:notification-toast", handleToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => {
            router.push(toast.clickActionUrl);
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }}
          className={cn(
            "pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border-2 border-primary/30",
            "bg-background/95 backdrop-blur-xl shadow-2xl hover:border-primary/60 transition-all cursor-pointer",
            "animate-in fade-in slide-in-from-top-4 duration-300"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary shadow-xs">
            <Bell className="h-5 w-5 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-foreground truncate">
              {toast.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 font-medium">
              {toast.body}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToasts((prev) => prev.filter((t) => t.id !== toast.id));
            }}
            className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
