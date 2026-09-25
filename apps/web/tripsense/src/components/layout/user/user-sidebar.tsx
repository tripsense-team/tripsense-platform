"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  MapPin,
  Heart,
  FolderBookmark,
  Sparkles,
  Plus,
  Settings,
  HelpCircle,
  LucideIcon,
  MessageSquareQuote,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useChatUnreadCount } from "@/features/chat";
import { useTranslation } from "@/i18n";



export interface NavItemDef {
  key: string;
  fallbackTitle: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

const mainNavDefs: NavItemDef[] = [
  {
    key: "nav.explore",
    fallbackTitle: "Explore",
    href: "/explore",
    icon: Compass,
  },
  {
    key: "nav.community",
    fallbackTitle: "Community",
    href: "/community",
    icon: MessageSquareQuote,
  },
  {
    key: "nav.chat",
    fallbackTitle: "Chat & Messages",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    key: "nav.places",
    fallbackTitle: "Places & Map",
    href: "/places",
    icon: MapPin,
  },
  {
    key: "nav.trips",
    fallbackTitle: "My Trips",
    href: "/trips",
    icon: FolderBookmark,
  },
  {
    key: "nav.savedPlaces",
    fallbackTitle: "Saved Places",
    href: "/saved",
    icon: Heart,
  },
  {
    key: "nav.collections",
    fallbackTitle: "Collections",
    href: "/collections",
    icon: FolderBookmark,
  },
  {
    key: "nav.aiPlanner",
    fallbackTitle: "AI Planner",
    href: "/ai-planner",
    icon: Sparkles,
    badge: "AI",
  },
];

const secondaryNavDefs: NavItemDef[] = [
  {
    key: "nav.settings",
    fallbackTitle: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    key: "common.settings",
    fallbackTitle: "Help & Support",
    href: "/support",
    icon: HelpCircle,
  },
];

export interface UserSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function UserSidebar({
  collapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse,
}: UserSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(false);
  const collapsed =
    externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const onToggleCollapse =
    externalToggleCollapse ?? (() => setInternalCollapsed((prev) => !prev));

  const pathname = usePathname();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [tripCount, setTripCount] = React.useState<number | null>(null);
  const { unreadConversationsCount } = useChatUnreadCount();

  React.useEffect(() => {
    function handleTripCountChanged(event: Event) {
      const count = (event as CustomEvent<number>).detail;
      if (typeof count === "number") {
        setTripCount(count);
      }
    }

    window.addEventListener(
      "trip-management:count-changed",
      handleTripCountChanged,
    );

    return () => {
      window.removeEventListener(
        "trip-management:count-changed",
        handleTripCountChanged,
      );
    };
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "relative flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0 hidden md:flex h-full overflow-hidden",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Sidebar Header / Quick Action */}
        <div className={cn("shrink-0", collapsed ? "p-3 flex justify-center" : "p-3")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  className="w-9 h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs transition-all p-0 flex items-center justify-center mx-auto shrink-0"
                >
                  <Link href="/trips/new">
                    <Plus className="h-4 w-4 shrink-0" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>
                {t("nav.createTrip")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              asChild
              className="w-full h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[13px] shadow-xs transition-all justify-center gap-2"
            >
              <Link href="/trips/new">
                <Plus className="h-4 w-4 shrink-0" />
                <span>{t("nav.createTrip")}</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Main Navigation Items */}
        <div
          className={cn(
            "flex-1 overflow-y-auto py-2 space-y-6 min-h-0",
            collapsed ? "px-0" : "px-3",
          )}
        >
          <div>
            {!collapsed && (
              <h4 className="px-3.5 text-overline text-muted-foreground uppercase mb-2 font-bold tracking-wider">
                {t("nav.menu")}
              </h4>
            )}
            <nav className={cn("space-y-0.5 w-full", collapsed && "flex flex-col items-center")}>
              {mainNavDefs.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`);
                const isChat = item.href === "/chat";
                const badge =
                  item.href === "/trips" &&
                  isAuthenticated &&
                  tripCount !== null
                    ? String(tripCount)
                    : item.badge;
                const title = t(item.key) || item.fallbackTitle;

                const linkElement = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-[38px] items-center gap-3 rounded-full px-3 py-2 text-[13px] transition-all duration-150 group relative",
                      isActive
                        ? "bg-neutral-200/90 text-foreground font-semibold shadow-2xs dark:bg-neutral-800 dark:text-foreground"
                        : "text-sidebar-foreground/80 hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800 font-medium",
                      collapsed &&
                        "justify-center p-0 w-9 h-9 min-h-9 mx-auto shrink-0 relative",
                    )}
                  >
                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105",
                          isActive
                            ? "text-foreground"
                            : "text-sidebar-foreground/75 group-hover:text-foreground",
                        )}
                      />
                      {collapsed && isChat && unreadConversationsCount > 0 && (
                        <span
                          aria-label={`${unreadConversationsCount} unread`}
                          className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-micro font-bold shadow-xs leading-none"
                        >
                          {unreadConversationsCount > 9 ? "9+" : unreadConversationsCount}
                        </span>
                      )}
                    </div>
                    {!collapsed && (
                      <span className="flex-1 truncate">{title}</span>
                    )}
                    {!collapsed && isChat && unreadConversationsCount > 0 ? (
                      <span
                        aria-label={`${unreadConversationsCount} unread`}
                        className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full bg-rose-500 text-white text-micro font-bold shadow-xs leading-none"
                      >
                        {unreadConversationsCount > 99 ? "99+" : unreadConversationsCount}
                      </span>
                    ) : !collapsed && badge ? (
                      <span
                        className={cn(
                          "text-micro px-1.5 py-0.5 rounded-full font-bold shrink-0",
                          badge === "AI"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        <div className="flex items-center gap-1.5">
                          <span>{title}</span>
                          {isChat && unreadConversationsCount > 0 ? (
                            <span className="text-micro px-1.5 py-0.5 rounded-full font-bold bg-rose-500 text-white">
                              {unreadConversationsCount}
                            </span>
                          ) : (
                            badge && (
                              <span className="text-micro px-1.5 py-0.5 rounded-full font-bold bg-muted/40">
                                {badge}
                              </span>
                            )
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkElement;
              })}
            </nav>

            {/* Mindtrip-style New Chat Secondary Pill Action */}
            <div className={cn("pt-2", collapsed ? "flex justify-center w-full px-0" : "px-1")}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="secondary"
                      className="w-9 h-9 rounded-full font-semibold text-sm bg-neutral-100 hover:bg-neutral-200/90 text-foreground border border-border/50 shadow-2xs transition-all p-0 flex items-center justify-center mx-auto shrink-0 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                      <Link href="/chat">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    {t("chat.dialogs.newChat.title") || "New conversation"}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  asChild
                  variant="secondary"
                  className="w-full h-9 rounded-full font-semibold text-[13px] bg-neutral-100 hover:bg-neutral-200/90 text-foreground border border-border/50 shadow-2xs transition-all justify-center gap-2 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  <Link href="/chat">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {t("chat.dialogs.newChat.title") || "New conversation"}
                    </span>
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div>
            {!collapsed && (
              <h4 className="px-3.5 text-overline text-muted-foreground uppercase mb-2 font-bold tracking-wider">
                {t("nav.account")}
              </h4>
            )}
            <nav className={cn("space-y-0.5 w-full", collapsed && "flex flex-col items-center")}>
              {secondaryNavDefs.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const title = t(item.key) || item.fallbackTitle;

                const linkElement = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-[38px] items-center gap-3 rounded-full px-3 py-2 text-[13px] transition-all duration-150 group",
                      isActive
                        ? "bg-neutral-200/90 text-foreground font-semibold shadow-2xs dark:bg-neutral-800 dark:text-foreground"
                        : "text-sidebar-foreground/80 hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800 font-medium",
                      collapsed &&
                        "justify-center p-0 w-9 h-9 min-h-9 mx-auto shrink-0",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                    {!collapsed && (
                      <span className="flex-1 truncate">{title}</span>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        {title}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkElement;
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Profile and Footer matching Mindtrip aesthetic */}
        <div className="mt-auto shrink-0 border-t border-border bg-sidebar/50">
          <div
            className={cn(
              "p-3 flex transition-all duration-200",
              collapsed
                ? "flex-col items-center justify-center gap-3 py-3 px-0 w-full"
                : "items-center justify-between gap-2",
            )}
          >
            {isAuthenticated && user ? (
              collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/profile"
                      className="w-9 h-9 flex items-center justify-center hover:opacity-80 transition-opacity mx-auto shrink-0"
                    >
                      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
                        <AvatarImage
                          src={user.avatar}
                          alt={user.name || user.email || "User"}
                        />
                        <AvatarFallback className="text-micro font-bold bg-primary/10 text-primary border border-primary/20">
                          {(user.name || user.email || "U")
                            .charAt(0)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={12}>
                    <div>
                      <p className="font-bold text-[13px]">
                        {user.name || user.email?.split("@")[0]}
                      </p>
                      <p className="text-micro opacity-80">
                        @{user.email ? user.email.split("@")[0] : "user"}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                  title={user.name || user.email || "Profile"}
                >
                  <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border">
                    <AvatarImage
                      src={user.avatar}
                      alt={user.name || user.email || "User"}
                    />
                    <AvatarFallback className="text-micro font-bold bg-primary/10 text-primary border border-primary/20">
                      {(user.name || user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-foreground truncate leading-tight">
                      {user.name || user.email?.split("@")[0]}
                    </p>
                    <p className="text-micro text-muted-foreground truncate leading-tight mt-0.5">
                      @{user.email ? user.email.split("@")[0] : "user"}
                    </p>
                  </div>
                </Link>
              )
            ) : (
              !collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    TripSense Platform
                  </p>
                </div>
              )
            )}

            <SidebarCollapseButton
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              className={collapsed ? "mx-auto" : ""}
            />
          </div>



          {!collapsed && (
            <div className="px-3.5 pb-3 text-[11px] text-muted-foreground/75 space-y-1 select-none">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link href="/support" className="hover:underline">
                  Help
                </Link>
                <span>·</span>
                <Link href="/support" className="hover:underline">
                  Terms
                </Link>
                <span>·</span>
                <Link href="/support" className="hover:underline">
                  Privacy
                </Link>
              </div>
              <p>© 2026 TripSense, Inc.</p>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );

}
