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
  Settings,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";


export interface AdminNavGroup {
  groupTitle: string;
  items: {
    title: string;
    href: string;
    icon: LucideIcon;
    badge?: string;
  }[];
}

const adminNavGroups: AdminNavGroup[] = [
  {
    groupTitle: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: Activity },
    ],
  },
  {
    groupTitle: "Management",
    items: [
      {
        title: "User Accounts",
        href: "/admin/users",
        icon: Users,
        badge: "12",
      },
      { title: "Destinations & Places", href: "/admin/places", icon: MapPin },
      { title: "Trips & Itineraries", href: "/admin/trips", icon: Route },
    ],
  },
  {
    groupTitle: "Moderation",
    items: [
      {
        title: "Reviews & Feedback",
        href: "/admin/reviews",
        icon: MessageSquare,
      },
      {
        title: "Reports & Flags",
        href: "/admin/reports",
        icon: Flag,
        badge: "3",
      },
    ],
  },
  {
    groupTitle: "System & Infrastructure",
    items: [
      { title: "Microservices Health", href: "/admin/services", icon: Server },
      { title: "System Logs", href: "/admin/logs", icon: FileText },
      { title: "Settings & Security", href: "/admin/settings", icon: Settings },
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
              TripSense Admin
            </span>
            <span className="text-micro text-muted-foreground font-mono">
              v1.0.0 • Control Center
            </span>
          </div>
        )}
      </div>

      {/* Admin Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {adminNavGroups.map((group) => (
          <div key={group.groupTitle}>
            {!collapsed && (
              <h4 className="px-3 text-overline text-muted-foreground uppercase mb-2">
                {group.groupTitle}
              </h4>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname?.startsWith(item.href));

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
                    title={collapsed ? item.title : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.title}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "text-micro px-1.5 py-0.5 rounded-full font-bold shrink-0",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-destructive/10 text-destructive border border-destructive/20",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
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
              TripSense Platform
            </span>
          )}
          <SidebarCollapseButton
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            collapseTitle="Collapse Admin Sidebar"
            expandTitle="Expand Admin Sidebar"
            className={collapsed ? "" : "ml-auto"}
          />
        </div>
      )}
    </aside>

  );
}
