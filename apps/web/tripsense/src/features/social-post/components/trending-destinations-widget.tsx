"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame, ArrowUpRight, Compass } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { TrendingDestination } from "../types";

interface TrendingDestinationsWidgetProps {
  destinations: TrendingDestination[];
}

export function TrendingDestinationsWidget({
  destinations,
}: TrendingDestinationsWidgetProps) {
  const { t } = useTranslation();

  if (!destinations || destinations.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xs transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              {t("social.trendingDestinations")}
            </h2>
            <p className="text-micro text-muted-foreground">
              {t("social.trendingDestinationsSubtitle")}
            </p>
          </div>
        </div>

        <Link
          href="/explore"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
        >
          <span>{t("social.explorePlaces")}</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Destination List */}
      <div className="mt-4 space-y-2.5">
        {destinations.map((dest) => (
          <Link
            key={dest.id}
            href={`/explore?destination=${dest.slug}`}
            className="group flex items-center gap-3 rounded-2xl bg-muted/40 p-2 transition-all hover:bg-muted/70 hover:shadow-xs focus-visible:outline-hidden"
          >
            {/* Thumbnail */}
            <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 overflow-hidden rounded-xl border border-border/60">
              <img
                src={dest.imageUrl}
                alt={dest.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
              />
            </div>

            {/* Destination Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-bold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                  {dest.cityNameKey
                    ? t(`social.${dest.cityNameKey}`)
                    : dest.name}
                </h3>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">
                  {dest.shareCountText}
                </span>
              </div>

              <p className="text-micro text-muted-foreground truncate mt-0.5">
                {dest.subtitleKey
                  ? t(`social.${dest.subtitleKey}`)
                  : dest.subtitle}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
