"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Menu, Sparkles, Moon, Sun } from "lucide-react";
import { Logo } from "@/components/shared";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
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
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>

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
