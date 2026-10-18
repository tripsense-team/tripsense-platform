"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Menu, Sparkles, Moon, Sun, Store } from "lucide-react";
import { Logo } from "@/components/shared";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { UserMenu } from "./user-menu";
import { NotificationCenter } from "@/features/notifications";
import { Button } from "@/components/ui/button";
import { useAuth, isUserPartner } from "@/features/auth";
import { useTranslation } from "@/i18n";

export interface UserHeaderProps {
  onSignInClick?: () => void;
  onMobileMenuClick?: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function UserHeader({
  onSignInClick,
  onMobileMenuClick,
  user: customUser,
}: UserHeaderProps) {
  const { user: authUser, isAuthenticated, status } = useAuth();
  const { t } = useTranslation();
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  const activeUser = customUser || authUser;
  const isLoggedIn = (isAuthenticated || !!customUser) && !!activeUser;
  const isInitializing = status === "initializing" || status === "checking";

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
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur-md transition-colors">
      {/* Left: Mobile menu toggle + Logo */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMobileMenuClick}
          className="md:hidden"
          aria-label={t("nav.menu")}
        >
          <Menu />
        </Button>
        <Logo />
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-2 md:gap-3">
        {isUserPartner(authUser) && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-xs font-semibold border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <Link href="/partner">
              <Store className="h-3.5 w-3.5" />
              <span>Kênh Đối tác</span>
            </Link>
          </Button>
        )}

        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-[13px] text-foreground hover:bg-muted"
        >
          <Link href="/ai-planner">
            <Sparkles className="text-primary h-4 w-4" />
            <span>{t("nav.aiPlanner")}</span>
          </Link>
        </Button>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label={t("common.theme")}
        >
          {theme === "light" ? (
            <Moon />
          ) : (
            <Sun className="text-amber-500" />
          )}
        </Button>

        {/* Notifications */}
        {isLoggedIn ? (
          <NotificationCenter />
        ) : null}

        {/* User Menu, Skeleton, or Sign In Button */}
        {isInitializing ? (
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse border border-border/50" />
        ) : isLoggedIn ? (
          <UserMenu user={activeUser} />
        ) : (
          <Button
            onClick={onSignInClick}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-control px-4 py-2 shadow-xs transition-all"
          >
            {t("auth.login")}
          </Button>
        )}
      </div>
    </header>
  );
}
