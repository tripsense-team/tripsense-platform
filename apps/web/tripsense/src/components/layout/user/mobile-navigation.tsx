"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MapPin, Heart, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useChatUnreadCount } from "@/features/chat";

const mobileItemDefs = [
  {
    key: "nav.explore",
    fallbackName: "Explore",
    href: "/explore",
    icon: Compass,
  },
  {
    key: "nav.chat",
    fallbackName: "Chat",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    key: "nav.trips",
    fallbackName: "Trips",
    href: "/trips",
    icon: MapPin,
  },
  {
    key: "nav.planner",
    fallbackName: "Planner",
    href: "/ai-planner",
    icon: Sparkles,
  },
  {
    key: "nav.saved",
    fallbackName: "Saved",
    href: "/saved",
    icon: Heart,
  },
];

export function MobileNavigation() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { unreadConversationsCount } = useChatUnreadCount();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-around px-2">
        {mobileItemDefs.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isChat = item.href === "/chat";
          const name = t(item.key) || item.fallbackName;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 text-caption font-medium transition-colors",
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {isChat && unreadConversationsCount > 0 && (
                  <span
                    aria-label={`${unreadConversationsCount} unread`}
                    className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-micro font-bold shadow-xs leading-none"
                  >
                    {unreadConversationsCount > 9 ? "9+" : unreadConversationsCount}
                  </span>
                )}
              </div>
              <span>{name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
