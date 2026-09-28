"use client";

import React from "react";
import { Database, CheckCircle2, Clock, RotateCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { PlaceStats } from "../types";

interface PlaceStatsCardProps {
  stats: PlaceStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export function PlaceStatsCard({ stats, loading, onRefresh }: PlaceStatsCardProps) {
  const { t } = useTranslation();

  const total = stats?.totalPlaces ?? 0;
  const enriched = stats?.enrichedPlaces ?? 0;
  const pending = stats?.pendingPlaces ?? 0;
  const percent = total > 0 ? Math.round((enriched / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{t("settings.statsCard.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("settings.statsCard.description")}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs transition hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{t("settings.statsCard.refreshStats")}</span>
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Places */}
        <div className="rounded-xl border border-border/50 bg-background/60 p-4 transition-all hover:bg-background/90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.statsCard.totalPlaces")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {total.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            MongoDB Collection: <span className="font-mono font-medium">places</span>
          </div>
        </div>

        {/* Fully Enriched */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all hover:bg-emerald-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {t("settings.statsCard.enrichedPlaces")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {enriched.toLocaleString()}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({percent}%)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
            {t("settings.statsCard.readyForReport")}
          </div>
        </div>

        {/* Pending Enrichment */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all hover:bg-amber-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("settings.statsCard.pendingPlaces")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {pending.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-amber-600/80 dark:text-amber-400/80">
            {t("settings.statsCard.needsPhotosReviews")}
          </div>
        </div>
      </div>
    </div>
  );
}
