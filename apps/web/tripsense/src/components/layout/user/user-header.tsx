"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Bell, Menu, Sparkles, Moon, Sun } from "lucide-react";
import { Logo } from "@/components/shared";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";

export interface UserHeaderProps {
  onSignInClick?: () => void;
  onMobileMenuClick?: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function UserHeader({ onSignInClick, onMobileMenuClick, user: customUser }: UserHeaderProps) {
  const { user: authUser, isAuthenticated, status } = useAuth();
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  const activeUser = customUser || authUser;
  const isLoggedIn = (isAuthenticated || !!customUser) && !!activeUser;
  const isInitializing = status === "initializing";

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
          className="h-9 w-9 md:hidden"
          aria-label="Open Mobile Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Logo />
      </div>

      {/* Middle: Search input bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search places, trips, or ask AI..."
            className="w-full rounded-full border border-border bg-muted/40 py-2 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-2xs font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Actions & User Menu */}
      <div className="flex items-center gap-2 md:gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-foreground hover:bg-muted"
        >
          <Link href="/ai-planner">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI Planner</span>
          </Link>
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-500" />}
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
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
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-4 py-2 shadow-xs transition-all"
          >
            Sign In
          </Button>
        )}
      </div>
    </header>
  );
}
