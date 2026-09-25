"use client";

import Link from "next/link";
import { Compass, Sparkles, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useTranslation } from "@/i18n";
import { siteConfig } from "@/config/site";

export interface LandingHeaderProps {
  onOpenAuthModal?: (mode: "signin" | "signup") => void;
}

export function LandingHeader({ onOpenAuthModal }: LandingHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 transition-all">
      <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-section-title text-foreground hover:opacity-90 transition-opacity"
        >
          <div className="p-1.5 rounded-xl bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </div>
          <span>{siteConfig.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-control text-muted-foreground">
          <Link
            href="#how-it-works"
            className="hover:text-foreground transition-colors"
          >
            {t("nav.howItWorks")}
          </Link>
          <Link
            href="#explore"
            className="hover:text-foreground transition-colors"
          >
            {t("nav.explore")}
          </Link>
          <Link
            href="#ai-assistant"
            className="hover:text-foreground transition-colors"
          >
            {t("nav.aiAssistant")}
          </Link>
          <Link
            href="#features"
            className="hover:text-foreground transition-colors"
          >
            {t("nav.features")}
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenAuthModal?.("signin")}
            className="font-medium"
          >
            {t("auth.login")}
          </Button>
          <Button
            size="sm"
            onClick={() => onOpenAuthModal?.("signup")}
            className="rounded-full gap-2 shadow-sm font-medium"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t("nav.startTrip")}</span>
          </Button>
        </div>

        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher variant="compact" />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader className="text-left pb-4 border-b border-border">
                <SheetTitle className="flex items-center gap-2 text-lg font-bold">
                  <Compass className="h-5 w-5 text-primary" />
                  <span>{siteConfig.name}</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                <Link
                  href="#how-it-works"
                  className="text-control text-muted-foreground hover:text-foreground"
                >
                  {t("nav.howItWorks")}
                </Link>
                <Link
                  href="#explore"
                  className="text-control text-muted-foreground hover:text-foreground"
                >
                  {t("nav.explore")}
                </Link>
                <Link
                  href="#ai-assistant"
                  className="text-control text-muted-foreground hover:text-foreground"
                >
                  {t("nav.aiAssistant")}
                </Link>
                <Link
                  href="#features"
                  className="text-control text-muted-foreground hover:text-foreground"
                >
                  {t("nav.features")}
                </Link>
                <div className="pt-4 border-t border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("common.language")}
                    </span>
                    <LanguageSwitcher variant="segmented" />
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => onOpenAuthModal?.("signin")}
                    className="w-full justify-center"
                  >
                    {t("auth.login")}
                  </Button>
                  <Button
                    onClick={() => onOpenAuthModal?.("signup")}
                    className="w-full justify-center rounded-full gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{t("nav.startTrip")}</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
