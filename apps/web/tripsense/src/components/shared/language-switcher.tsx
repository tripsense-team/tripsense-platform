"use client";

import * as React from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface LanguageSwitcherProps {
  className?: string;
  variant?: "default" | "compact" | "segmented";
  align?: "start" | "center" | "end";
}

export function LanguageSwitcher({
  className = "",
  variant = "default",
  align = "end",
}: LanguageSwitcherProps) {
  const { locale, setLocale, availableLocales, t } = useTranslation();
  const currentLocale =
    availableLocales.find((l) => l.code === locale) || availableLocales[0];

  // Segmented control variant (ideal for settings, mobile sheets, or sidebars)
  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex items-center gap-1 p-1 bg-muted/60 backdrop-blur-xs border border-border/60 rounded-full ${className}`}
        role="radiogroup"
        aria-label={t("common.selectLanguage") || "Select Language"}
      >
        {availableLocales.map((loc) => {
          const isActive = loc.code === locale;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => setLocale(loc.code)}
              role="radio"
              aria-checked={isActive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-background text-foreground shadow-xs font-semibold ring-1 ring-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <span className="text-sm leading-none">{loc.flag}</span>
              <span>{loc.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant (icon + flag badge, ideal for dense mobile headers)
  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`group relative h-9 w-9 rounded-full border border-border/40 hover:border-border hover:bg-muted/80 transition-all duration-200 ${className}`}
            aria-label={t("common.selectLanguage") || "Select Language"}
          >
            <Globe className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors group-hover:rotate-12 duration-300" />
            <span className="absolute -bottom-0.5 -right-0.5 text-xs leading-none drop-shadow-xs">
              {currentLocale?.flag}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <LanguageDropdownContent
          locale={locale}
          availableLocales={availableLocales}
          setLocale={setLocale}
          align={align}
          headerTitle={t("common.selectLanguage") || "Select Language"}
        />
      </DropdownMenu>
    );
  }

  // Default variant: Modern pill button with rotating globe, flag, uppercase code, and animated chevron
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`group h-9 px-3 rounded-full text-xs font-semibold gap-2 bg-background/70 backdrop-blur-md border border-border/70 hover:border-primary/40 hover:bg-muted/60 transition-all duration-200 shadow-2xs ${className}`}
          aria-label={t("common.selectLanguage") || "Select Language"}
        >
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:rotate-12" />
            <span className="text-sm leading-none">{currentLocale?.flag}</span>
            <span className="text-xs uppercase font-bold tracking-wide text-foreground">
              {currentLocale?.code}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground/70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <LanguageDropdownContent
        locale={locale}
        availableLocales={availableLocales}
        setLocale={setLocale}
        align={align}
        headerTitle={t("common.selectLanguage") || "Select Language"}
      />
    </DropdownMenu>
  );
}

interface LanguageDropdownContentProps {
  locale: string;
  availableLocales: Array<{
    code: string;
    name: string;
    englishName?: string;
    flag: string;
  }>;
  setLocale: (code: string) => void;
  align: "start" | "center" | "end";
  headerTitle: string;
}

function LanguageDropdownContent({
  locale,
  availableLocales,
  setLocale,
  align,
  headerTitle,
}: LanguageDropdownContentProps) {
  return (
    <DropdownMenuContent
      align={align}
      sideOffset={8}
      className="w-56 rounded-2xl p-1.5 shadow-xl border border-border/80 bg-popover/95 backdrop-blur-xl animate-in fade-in-0 zoom-in-95"
    >
      <DropdownMenuLabel className="px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Globe className="h-3 w-3" />
        <span>{headerTitle}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator className="my-1 bg-border/60" />
      {availableLocales.map((loc) => {
        const isSelected = loc.code === locale;
        return (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => setLocale(loc.code)}
            className={`group flex items-center justify-between rounded-xl px-2.5 py-2 cursor-pointer transition-all duration-150 ${
              isSelected
                ? "bg-primary/10 text-primary font-semibold"
                : "text-foreground hover:bg-accent/60"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/70 text-base shadow-2xs group-hover:scale-105 transition-transform">
                {loc.flag}
              </span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium leading-snug">
                  {loc.name}
                </span>
                {loc.englishName && loc.englishName !== loc.name && (
                  <span className="text-2xs text-muted-foreground leading-tight">
                    {loc.englishName}
                  </span>
                )}
              </div>
            </div>

            {isSelected && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xs shadow-2xs animate-in zoom-in-50 duration-150">
                <Check className="h-3 w-3 stroke-[2.5]" />
              </span>
            )}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  );
}
