"use client";

import * as React from "react";
import {
  Coffee,
  Compass,
  Hotel,
  Landmark,
  Utensils,
  Waves,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export type PlaceVisualTheme =
  | "cafe"
  | "dining"
  | "beach"
  | "heritage"
  | "stay"
  | "explore";

interface ThemeStyle {
  backdrop: string;
  badge: string;
  labelKey:
    | "places.photoFallback.cafe"
    | "places.photoFallback.dining"
    | "places.photoFallback.beach"
    | "places.photoFallback.heritage"
    | "places.photoFallback.stay"
    | "places.photoFallback.explore";
  defaultLabel: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const THEME_STYLES: Record<PlaceVisualTheme, ThemeStyle> = {
  cafe: {
    backdrop:
      "bg-gradient-to-br from-amber-500/15 via-orange-400/10 to-muted/90",
    badge:
      "border-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    labelKey: "places.photoFallback.cafe",
    defaultLabel: "Café & Drinks",
    Icon: Coffee,
  },
  dining: {
    backdrop:
      "bg-gradient-to-br from-rose-500/15 via-orange-500/10 to-muted/90",
    badge: "border-rose-500/20 bg-rose-500/15 text-rose-600 dark:text-rose-400",
    labelKey: "places.photoFallback.dining",
    defaultLabel: "Dining & Local Food",
    Icon: Utensils,
  },
  beach: {
    backdrop: "bg-gradient-to-br from-sky-500/15 via-cyan-500/10 to-muted/90",
    badge: "border-sky-500/20 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    labelKey: "places.photoFallback.beach",
    defaultLabel: "Coast & Nature",
    Icon: Waves,
  },
  heritage: {
    backdrop:
      "bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-muted/90",
    badge:
      "border-emerald-500/20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    labelKey: "places.photoFallback.heritage",
    defaultLabel: "Landmark & Culture",
    Icon: Landmark,
  },
  stay: {
    backdrop:
      "bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-muted/90",
    badge:
      "border-indigo-500/20 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    labelKey: "places.photoFallback.stay",
    defaultLabel: "Stay & Hospitality",
    Icon: Hotel,
  },
  explore: {
    backdrop: "bg-gradient-to-br from-primary/15 via-accent/35 to-muted/90",
    badge: "border-primary/20 bg-primary/15 text-primary",
    labelKey: "places.photoFallback.explore",
    defaultLabel: "Explore Destination",
    Icon: Compass,
  },
};

const GENERIC_LABELS = new Set([
  "point_of_interest",
  "establishment",
  "food",
  "store",
]);

function matchThemeToken(value: string): PlaceVisualTheme | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (
    /cà phê|cafe|café|coffee|tea_house|bakery_cafe|trà sữa|đồ uống/i.test(text)
  ) {
    return "cafe";
  }
  if (
    /beach|biển|bãi biển|sea|ocean|island|đảo|park|công viên|natural_feature|scenic_spot/i.test(
      text,
    )
  ) {
    return "beach";
  }
  if (
    /temple|pagoda|chùa|nhà thờ|church|museum|bảo tàng|heritage|historical|landmark|tourist_attraction|attraction|điểm tham quan|địa điểm khám phá|du lịch|amusement_park|di tích|lăng/i.test(
      text,
    )
  ) {
    return "heritage";
  }
  if (
    /homestay|home_stay|home stay|hotel|resort|hostel|guest_house|lodging|accommodation|khách sạn|lưu trú|motel|villa|khu nghỉ|bungalow/i.test(
      text,
    )
  ) {
    return "stay";
  }
  if (
    /restaurant|seafood|vietnamese|noodle|bistro|street_food|bakery|bar|nhà hàng|quán ăn|hải sản|ẩm thực|cơm|phở|bún|lẩu|nướng|pizza|steak|food/i.test(
      text,
    )
  ) {
    return "dining";
  }
  return null;
}

export function resolvePlaceVisualTheme(
  primaryType?: string,
  categories?: string[],
): PlaceVisualTheme {
  if (primaryType && !GENERIC_LABELS.has(primaryType.toLowerCase())) {
    const direct = matchThemeToken(primaryType);
    if (direct) return direct;
  }

  for (const cat of categories ?? []) {
    if (!cat || GENERIC_LABELS.has(cat.toLowerCase())) continue;
    const matched = matchThemeToken(cat);
    if (matched) return matched;
  }

  if (primaryType) {
    const fallbackDirect = matchThemeToken(primaryType);
    if (fallbackDirect) return fallbackDirect;
  }
  for (const cat of categories ?? []) {
    const fallbackCat = matchThemeToken(cat);
    if (fallbackCat) return fallbackCat;
  }

  return "explore";
}

export function PlaceCategoryIcon({
  primaryType,
  category,
  categories,
  className = "h-3.5 w-3.5 text-muted-foreground shrink-0",
}: {
  primaryType?: string;
  category?: string;
  categories?: string[];
  className?: string;
}) {
  const combinedCategories = category
    ? [category, ...(categories ?? [])]
    : categories;
  const theme = resolvePlaceVisualTheme(primaryType, combinedCategories);
  const { Icon } = THEME_STYLES[theme];
  return <Icon className={className} aria-hidden />;
}

export interface PlacePhotoFallbackProps {
  primaryType?: string;
  categories?: string[];
  variant?: "card" | "gallery" | "compact";
  className?: string;
}

/**
 * Pure UI category-themed illustration shown when a place temporarily lacks verified Cloudinary
 * photos. Never mutates persisted data or injects unrelated stock photos.
 */
export function PlacePhotoFallback({
  primaryType,
  categories,
  variant = "card",
  className,
}: PlacePhotoFallbackProps) {
  const { t } = useTranslation();
  const theme = resolvePlaceVisualTheme(primaryType, categories);
  const style = THEME_STYLES[theme];
  const { Icon } = style;
  const isGallery = variant === "gallery";
  const isCompact = variant === "compact";

  return (
    <div
      data-fallback-theme={theme}
      className={cn(
        "relative flex h-full w-full flex-col items-center justify-center overflow-hidden select-none text-center",
        style.backdrop,
        isGallery ? "p-6" : isCompact ? "p-3" : "p-4",
        className,
      )}
    >
      {/* Subtle decorative topographic backdrop */}
      <svg
        aria-hidden="true"
        viewBox="0 0 320 200"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-foreground opacity-[0.06]"
      >
        <circle
          cx="275"
          cy="36"
          r="68"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle
          cx="275"
          cy="36"
          r="102"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M0 164 Q 80 128 160 156 T 320 144 L 320 200 L 0 200 Z"
          fill="currentColor"
        />
      </svg>

      <div
        className={cn(
          "relative z-10 flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xs shadow-2xs",
          isGallery ? "px-6 py-4" : isCompact ? "px-3.5 py-2.5" : "px-4 py-3",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-xl border",
            style.badge,
            isGallery ? "h-12 w-12" : isCompact ? "h-8 w-8" : "h-10 w-10",
          )}
        >
          <Icon
            className={
              isGallery ? "h-6 w-6" : isCompact ? "h-4 w-4" : "h-5 w-5"
            }
            aria-hidden
          />
        </div>

        <span
          className={cn(
            "font-medium text-foreground/90",
            isGallery ? "text-sm" : "text-xs",
          )}
        >
          {t(style.labelKey, { defaultValue: style.defaultLabel })}
        </span>

        <span className="text-[11px] leading-tight text-muted-foreground">
          {t("places.noLicensedPhotos", {
            defaultValue: "No licensed photos available",
          })}
        </span>
      </div>
    </div>
  );
}
