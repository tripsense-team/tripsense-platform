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
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  HelpCircle,
  LucideIcon,
  MessageCircle,
  MessageSquareQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
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
    fallbackTitle: "Chat",
    href: "/chat",
    icon: MessageCircle,
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
  collapsed = false,
  onToggleCollapse,
}: UserSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [tripCount, setTripCount] = React.useState<number | null>(null);

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
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0 hidden md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Sidebar Header / Quick Action */}
      <div className="p-3">
        <Button
          asChild
          className={cn(
            "w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs transition-all",
            collapsed ? "px-0 justify-center" : "justify-start gap-2",
          )}
        >
          <Link href="/trips/new">
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t("nav.createTrip")}</span>}
          </Link>
        </Button>
      </div>

      {/* Main Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        <div>
          {!collapsed && (
            <h4 className="px-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t("nav.menu")}
            </h4>
          )}
          <nav className="space-y-1">
            {mainNavDefs.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const badge =
                item.href === "/trips" && isAuthenticated && tripCount !== null
                  ? String(tripCount)
                  : item.badge;
              const title = t(item.key) || item.fallbackTitle;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group relative",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                  title={collapsed ? title : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                      isActive && "text-primary",
                    )}
                  />
                  {!collapsed && (
                    <span className="flex-1 truncate">{title}</span>
                  )}
                  {!collapsed && badge && (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0",
                        badge === "AI"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          {!collapsed && (
            <h4 className="px-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t("nav.account")}
            </h4>
          )}
          <nav className="space-y-1">
            {secondaryNavDefs.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const title = t(item.key) || item.fallbackTitle;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                  title={collapsed ? title : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!collapsed && (
                    <span className="flex-1 truncate">{title}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Collapse Toggle Button */}
      {onToggleCollapse && (
        <div className="p-3 border-t border-border flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}
