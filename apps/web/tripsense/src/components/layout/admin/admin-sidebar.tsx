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
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      { title: "User Accounts", href: "/admin/users", icon: Users, badge: "12" },
      { title: "Destinations & Places", href: "/admin/places", icon: MapPin },
      { title: "Trips & Itineraries", href: "/admin/trips", icon: Route },
    ],
  },
  {
    groupTitle: "Moderation",
    items: [
      { title: "Reviews & Feedback", href: "/admin/reviews", icon: MessageSquare },
      { title: "Reports & Flags", href: "/admin/reports", icon: Flag, badge: "3" },
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

export function AdminSidebar({ collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out shrink-0 hidden md:flex",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Admin Branding Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col truncate">
            <span className="font-bold text-sm tracking-tight text-foreground">TripSense Admin</span>
            <span className="text-2xs text-muted-foreground font-mono">v1.0.0 • Control Center</span>
          </div>
        )}
      </div>

      {/* Admin Nav Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {adminNavGroups.map((group) => (
          <div key={group.groupTitle}>
            {!collapsed && (
              <h4 className="px-3 text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.groupTitle}
              </h4>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group relative",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    title={collapsed ? item.title : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                    {!collapsed && item.badge && (
                      <span
                        className={cn(
                          "text-2xs px-1.5 py-0.5 rounded-full font-bold shrink-0",
                          isActive
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-destructive/10 text-destructive border border-destructive/20"
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
        <div className="p-3 border-t border-border flex items-center justify-between">
          {!collapsed && (
            <span className="text-2xs text-muted-foreground px-2">TripSense Platform</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground ml-auto"
            title={collapsed ? "Expand Admin Sidebar" : "Collapse Admin Sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </aside>
  );
}
