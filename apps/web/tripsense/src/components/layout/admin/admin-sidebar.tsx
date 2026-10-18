"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Route,
  MessageSquare,
  Flag,
  Server,
  Activity,
  FileText,
  ShieldCheck,
  Store,
  Building2,
  DollarSign,
  KeyRound,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import { useTranslation } from "@/i18n";

export interface AdminNavItem {
  titleKey: string;
  defaultTitle: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeKey?: string;
}

export interface AdminNavGroup {
  groupKey: string;
  defaultTitle: string;
  items: AdminNavItem[];
}

const adminNavGroups: AdminNavGroup[] = [
  {
    groupKey: "admin.sidebar.overview",
    defaultTitle: "Overview",
    items: [
      { titleKey: "admin.sidebar.dashboard", defaultTitle: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { titleKey: "admin.sidebar.analytics", defaultTitle: "Analytics", href: "/admin/analytics", icon: Activity },
    ],
  },
  {
    groupKey: "admin.sidebar.management",
    defaultTitle: "Management",
    items: [
      {
        titleKey: "admin.sidebar.userAccounts",
        defaultTitle: "User Accounts",
        href: "/admin/users",
        icon: Users,
        badge: "12",
      },
      { titleKey: "admin.sidebar.destinationsPlaces", defaultTitle: "Destinations & Places", href: "/admin/places", icon: MapPin },
      { titleKey: "admin.sidebar.tripsItineraries", defaultTitle: "Trips & Itineraries", href: "/admin/trips", icon: Route },
      {
        titleKey: "admin.sidebar.partnerApprovals",
        defaultTitle: "Partner Approvals",
        href: "/admin/partners",
        icon: Store,
        badgeKey: "admin.sidebar.newBadge",
        badge: "New",
      },
      {
        titleKey: "admin.sidebar.hotelListings",
        defaultTitle: "Hotel Listings",
        href: "/admin/hotels",
        icon: Building2,
      },
      {
        titleKey: "admin.sidebar.financePayouts",
        defaultTitle: "Finance & Payouts",
        href: "/admin/hotels/commerce",
        icon: DollarSign,
      },
    ],
  },
  {
    groupKey: "admin.sidebar.moderation",
    defaultTitle: "Moderation",
    items: [
      {
        titleKey: "admin.sidebar.reviewsFeedback",
        defaultTitle: "Reviews & Feedback",
        href: "/admin/reviews",
        icon: MessageSquare,
      },
      {
        titleKey: "admin.sidebar.reportsFlags",
        defaultTitle: "Reports & Flags",
        href: "/admin/reports",
        icon: Flag,
        badge: "3",
      },
    ],
  },
  {
    groupKey: "admin.sidebar.systemInfrastructure",
    defaultTitle: "System & Infrastructure",
    items: [
      { titleKey: "admin.sidebar.microservicesHealth", defaultTitle: "Microservices Health", href: "/admin/services", icon: Server },
      { titleKey: "admin.sidebar.systemLogs", defaultTitle: "System Logs", href: "/admin/logs", icon: FileText },
      { titleKey: "admin.sidebar.apiKeysIntegrations", defaultTitle: "API Keys & AI Services", href: "/admin/settings", icon: KeyRound },
    ],
  },
];

export interface AdminSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AdminSidebar({
  collapsed = false,
  onToggleCollapse,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const allHrefs = React.useMemo(
    () => adminNavGroups.flatMap((g) => g.items.map((i) => i.href)),
    [],
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0 hidden md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Admin Branding Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col truncate">
            <span className="text-heading text-foreground">
              {t("admin.sidebar.brandTitle") || "TripSense Admin"}
            </span>
            <span className="text-micro text-muted-foreground font-mono">
              {t("admin.sidebar.brandSubtitle") || "v1.0.0 • Control Center"}
            </span>
          </div>
        )}
      </div>

      {/* Admin Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {adminNavGroups.map((group) => {
          const groupTitle = t(group.groupKey) || group.defaultTitle;
          return (
            <div key={group.groupKey}>
              {!collapsed && (
                <h4 className="px-3 text-overline text-muted-foreground uppercase mb-2">
                  {groupTitle}
                </h4>
              )}
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const itemTitle = t(item.titleKey) || item.defaultTitle;
                  const isActive = (() => {
                    if (!pathname) return false;
                    if (pathname === item.href) return true;
                    if (item.href === "/admin") return false;

                    // Match alternative finance route if navigated directly
                    if (
                      item.href === "/admin/hotels/commerce" &&
                      (pathname === "/admin/finance" || pathname.startsWith("/admin/finance/"))
                    ) {
                      return true;
                    }

                    // If another more specific menu item matches the current pathname, don't highlight this parent item
                    const hasMoreSpecificMatch = allHrefs.some(
                      (otherHref) =>
                        otherHref !== item.href &&
                        otherHref.startsWith(item.href) &&
                        (pathname === otherHref || pathname.startsWith(otherHref + "/")),
                    );
                    if (hasMoreSpecificMatch) return false;

                    return pathname.startsWith(item.href + "/") || pathname === item.href;
                  })();

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-control transition-all duration-150 group relative",
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                      title={collapsed ? itemTitle : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{itemTitle}</span>
                      )}
                      {!collapsed && (item.badgeKey || item.badge) && (
                        <span
                          className={cn(
                            "text-micro px-1.5 py-0.5 rounded-full font-bold shrink-0",
                            isActive
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-destructive/10 text-destructive border border-destructive/20",
                          )}
                        >
                          {item.badgeKey ? t(item.badgeKey) : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer / Collapse Toggle */}
      {onToggleCollapse && (
        <div
          className={cn(
            "p-3 border-t border-border flex transition-all duration-200",
            collapsed
              ? "flex-col items-center justify-center py-3 px-2 gap-3"
              : "items-center justify-between",
          )}
        >
          {!collapsed && (
            <span className="text-micro text-muted-foreground px-2">
              {t("admin.sidebar.platformLabel") || "TripSense Platform"}
            </span>
          )}
          <SidebarCollapseButton
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            collapseTitle={t("admin.sidebar.collapseSidebar") || "Collapse Admin Sidebar"}
            expandTitle={t("admin.sidebar.expandSidebar") || "Expand Admin Sidebar"}
            className={collapsed ? "" : "ml-auto"}
          />
        </div>
      )}
    </aside>
  );
}
