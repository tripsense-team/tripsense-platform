"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Heart,
  FolderBookmark,
  Sparkles,
  Settings,
  Database,
  LucideIcon,
  MessageSquareQuote,
  MessageSquare,
  MoreHorizontal,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserRole, LogoutModal, useAuthStore } from "@/features/auth";
import { useChatUnreadCount } from "@/features/chat";
import { useTranslation } from "@/i18n";
import { toggleAiDrawer, useAiDrawerStore } from "@/stores/use-ai-drawer-store";

export interface NavItemDef {
  key: string;
  fallbackTitle: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  adminOnly?: boolean;
}

const mainNavDefs: NavItemDef[] = [
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
    icon: Search,
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
    key: "nav.aiPlanner",
    fallbackTitle: "AI Planner",
    href: "/ai-planner",
    icon: Sparkles,
    badge: "AI",
  },
];

const secondaryNavDefs: NavItemDef[] = [
  {
    key: "nav.dataEnrichment",
    fallbackTitle: "Data Enrichment",
    href: "/admin/settings",
    icon: Database,
    adminOnly: true,
  },
];

export interface UserSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  disableTransition?: boolean;
  className?: string;
}

export function UserSidebar({
  collapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse,
  disableTransition = false,
  className,
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
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const isDrawerOpen = useAiDrawerStore((state) => state.isOpen);
  const showTooltips = collapsed && !isDrawerOpen;

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
    <>
      <aside
        className={cn(
          "relative z-50 flex flex-col border-r border-border bg-sidebar text-sidebar-foreground shrink-0 hidden md:flex h-full overflow-hidden select-none",
          disableTransition
            ? "transition-none"
            : "transition-[width] duration-300 ease-in-out will-change-[width]",
          collapsed ? "w-16" : "w-64",
          className,
        )}
      >
        {/* Main Navigation Items */}
        <div
          className={cn(
            "flex-1 overflow-y-auto py-5 space-y-6 min-h-0 scrollbar-none",
            collapsed ? "px-0" : "px-3",
          )}
        >
          <div>
            <nav className="w-full space-y-2.5">
              {mainNavDefs.map((item) => {
                const Icon = item.icon;
                const isAi = item.href === "/ai-planner";
                const isAiActive = isAi && isDrawerOpen;
                const isActive =
                  pathname === item.href ||
                  pathname?.startsWith(`${item.href}/`) ||
                  isAiActive;
                const isChat = item.href === "/chat";
                const badge =
                  item.href === "/trips" &&
                  isAuthenticated &&
                  tripCount !== null
                    ? String(tripCount)
                    : item.badge;
                const rawTitle = t(item.key);
                const title =
                  rawTitle && rawTitle !== item.key
                    ? rawTitle
                    : item.fallbackTitle;

                const linkElement = (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-ai-trigger={isAi ? "true" : undefined}
                    data-ai-v2-trigger={isAi ? "true" : undefined}
                    onClick={
                      isAi
                        ? (e) => {
                            e.preventDefault();
                            toggleAiDrawer();
                          }
                        : undefined
                    }
                    className={cn(
                      "flex items-center rounded-full text-[14px] transition-colors duration-150 group relative overflow-hidden",
                      isActive
                        ? "bg-neutral-200/90 text-neutral-950 font-semibold shadow-2xs dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-neutral-900 hover:bg-neutral-200/70 hover:text-black dark:text-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white font-medium",
                      collapsed
                        ? "h-10 w-10 justify-center p-0 mx-auto"
                        : "h-10 w-full px-0",
                    )}
                  >
                    <div className="relative flex items-center justify-center shrink-0 w-10 h-10">
                      <Icon
                        className={cn(
                          "h-5 w-5 shrink-0 transition-transform group-hover:scale-105",
                          isActive
                            ? "text-neutral-950 dark:text-neutral-100"
                            : "text-neutral-900 group-hover:text-black dark:text-neutral-100 dark:group-hover:text-white",
                        )}
                      />
                      {collapsed && isChat && unreadConversationsCount > 0 && (
                        <span
                          aria-label={`${unreadConversationsCount} unread`}
                          className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-white text-micro font-bold shadow-xs leading-none"
                        >
                          {unreadConversationsCount > 9 ? "9+" : unreadConversationsCount}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between min-w-0 overflow-hidden whitespace-nowrap pr-3">
                        <span className="truncate">{title}</span>
                        {isChat && unreadConversationsCount > 0 ? (
                          <span
                            aria-label={`${unreadConversationsCount} unread`}
                            className="ml-auto inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full bg-rose-500 text-white text-micro font-bold shadow-xs leading-none"
                          >
                            {unreadConversationsCount > 99 ? "99+" : unreadConversationsCount}
                          </span>
                        ) : badge ? (
                          <span
                            className={cn(
                              "text-micro px-1.5 py-0.5 rounded-full font-bold shrink-0 ml-auto",
                              badge === "AI"
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Link>
                );

                return (
                  <Tooltip key={item.href} open={showTooltips ? undefined : false}>
                    <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                    {showTooltips && (
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
                    )}
                  </Tooltip>
                );
              })}
            </nav>

            {/* Create Trip Action */}
            <div
              className={cn(
                "h-20 pt-6 pb-2 transition-all duration-300 ease-in-out",
                collapsed
                  ? "overflow-hidden opacity-0 pointer-events-none h-0 p-0"
                  : "overflow-visible opacity-100",
              )}
            >
              <Button
                asChild
                variant="secondary"
                className="h-10 w-full rounded-full border border-border/50 bg-secondary text-secondary-foreground shadow-2xs hover:bg-accent font-semibold text-[13px]"
              >
                <Link
                  href="/trips/new"
                  className="flex h-full w-full items-center justify-center text-center"
                >
                  {t("nav.createTrip")}
                </Link>
              </Button>
            </div>
          </div>

          <div>
            <nav className="w-full space-y-2.5">
              {secondaryNavDefs
                .filter(
                  (item) => !item.adminOnly || user?.role === UserRole.ADMIN,
                )
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  const title = t(item.key) || item.fallbackTitle;

                  const linkElement = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center rounded-full text-[14px] transition-colors duration-150 group overflow-hidden",
                        isActive
                          ? "bg-neutral-200/90 text-neutral-950 font-semibold shadow-2xs dark:bg-neutral-800 dark:text-neutral-100"
                          : "text-neutral-900 hover:bg-neutral-200/70 hover:text-black dark:text-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white font-medium",
                        collapsed
                          ? "h-10 w-10 justify-center p-0 mx-auto"
                          : "h-10 w-full px-0",
                      )}
                    >
                      <div className="relative flex items-center justify-center shrink-0 w-10 h-10">
                        <Icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-transform group-hover:scale-105",
                            isActive
                              ? "text-neutral-950 dark:text-neutral-100"
                              : "text-neutral-900 group-hover:text-black dark:text-neutral-100 dark:group-hover:text-white",
                          )}
                        />
                      </div>
                      {!collapsed && (
                        <span className="truncate pr-3 overflow-hidden whitespace-nowrap">
                          {title}
                        </span>
                      )}
                    </Link>
                  );

                  return (
                    <Tooltip key={item.href} open={showTooltips ? undefined : false}>
                      <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                      {showTooltips && (
                        <TooltipContent side="right" sideOffset={12}>
                          {title}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity mx-auto shrink-0 outline-none rounded-full cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                      title={user.name || user.email || "User menu"}
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
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="end" sideOffset={12} className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-foreground truncate">
                          {user.name || user.email?.split("@")[0]}
                        </p>
                        <p className="text-micro leading-none text-muted-foreground truncate">
                          @{user.email ? user.email.split("@")[0] : "user"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings?tab=personalization"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>{t("nav.personalization", { defaultValue: "Cá nhân hóa" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        <span>{t("nav.settings", { defaultValue: "Cài đặt" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <User className="h-4 w-4" />
                        <span>{t("nav.profile", { defaultValue: "Hồ sơ" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setLogoutModalOpen(true)}
                      className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t("common.logOut", { defaultValue: "Đăng xuất" })}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2.5 min-w-0 flex-1 hover:bg-muted/70 p-1.5 -ml-1 rounded-xl transition-all text-left outline-none group cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
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
                      <MoreHorizontal className="h-4 w-4 text-muted-foreground/70 group-hover:text-foreground shrink-0 transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" sideOffset={10} className="w-60">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-foreground truncate">
                          {user.name || user.email?.split("@")[0]}
                        </p>
                        <p className="text-micro leading-none text-muted-foreground truncate">
                          @{user.email ? user.email.split("@")[0] : "user"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings?tab=personalization"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span>{t("nav.personalization", { defaultValue: "Cá nhân hóa" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Settings className="h-4 w-4" />
                        <span>{t("nav.settings", { defaultValue: "Cài đặt" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <User className="h-4 w-4" />
                        <span>{t("nav.profile", { defaultValue: "Hồ sơ" })}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setLogoutModalOpen(true)}
                      className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t("common.logOut", { defaultValue: "Đăng xuất" })}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
              collapseTitle={t("nav.collapseSidebar", { defaultValue: "Collapse sidebar" })}
              expandTitle={t("nav.expandSidebar", { defaultValue: "Expand sidebar" })}
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

      <LogoutModal open={logoutModalOpen} onOpenChange={setLogoutModalOpen} />
    </>
  );
}
