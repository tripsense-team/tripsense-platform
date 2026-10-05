"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Moon,
  Sun,
  Server,
  RefreshCw,
  ShieldAlert,
  LogOut,
} from "lucide-react";
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
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth, LogoutModal } from "@/features/auth";
import { useTranslation } from "@/i18n";

export interface AdminHeaderProps {
  systemHealth?: "healthy" | "degraded" | "error";
  adminUser?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function AdminHeader({
  systemHealth = "healthy",
  adminUser: customAdmin,
}: AdminHeaderProps) {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);

  const activeAdmin = customAdmin || authUser;

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/90 px-4 md:px-6 backdrop-blur-md">
        {/* Search & System Status indicator */}
        <div className="flex items-center gap-4 flex-1">
          {/* System Health Badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs">
            {systemHealth === "healthy" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Server className="h-3.5 w-3.5" /> All Services Operational
                </span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" /> Degraded Services
                </span>
              </>
            )}
          </div>

          {/* Global Admin Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search users, places, trips, or service logs..."
              className="w-full rounded-lg border border-border bg-card py-1.5 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* System Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t("common.refresh")}</span>
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-lg text-muted-foreground hover:text-foreground"
            aria-label={t("common.theme")}
          >
            {theme === "light" ? (
              <Moon />
            ) : (
              <Sun className="text-amber-500" />
            )}
          </Button>

          {/* Admin Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Admin Notifications"
          >
            <Bell />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
          </Button>

          {/* Admin User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 outline-none focus:ring-2 focus:ring-primary">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={activeAdmin?.avatar}
                    alt={activeAdmin?.name || activeAdmin?.email || "Admin"}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                    AD
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-0.5">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {activeAdmin?.name || activeAdmin?.email || "System Admin"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeAdmin?.email || "admin@tripsense.app"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="cursor-pointer">
                  {t("nav.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/services" className="cursor-pointer">
                  Service Status Monitor
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href="/explore"
                  className="cursor-pointer text-muted-foreground"
                >
                  Exit to Main Site
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setLogoutModalOpen(true)}
                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>{t("common.logOut")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <LogoutModal open={logoutModalOpen} onOpenChange={setLogoutModalOpen} />
    </>
  );
}
