"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Database, Globe } from "lucide-react";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { TokenPoolCard } from "./token-pool-card";
import { PlaceStatsCard } from "./place-stats-card";
import { BatchEnrichmentCard } from "./batch-enrichment-card";
import { fetchPlaceStats } from "../services/settings-api";
import type { PlaceStats } from "../types";

export function SettingsView() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PlaceStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await fetchPlaceStats();
      setStats(data);
    } catch (err) {
      console.error("Failed to load place stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleKeyUpdated = (newMaskedKey: string) => {
    setStats((prev) =>
      prev
        ? {
            ...prev,
            zioMapKeyConfigured: true,
            zioMapKeyMasked: newMaskedKey,
          }
        : null,
    );
  };

  return (
    <div className="min-h-screen bg-background/50 pb-20 pt-6">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {t("settings.title")}
                </h1>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  Admin Tools
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {t("settings.subtitle")}
              </p>
            </div>
          </div>

          {/* Quick Preferences / Language Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 shadow-xs">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <LanguageSwitcher variant="compact" />
            </div>
          </div>
        </div>

        {/* Settings Body */}
        <div className="mt-8 space-y-6">
          {/* Section 1: Token Pool Manager & Auto-Rotation (ZioMap & Gemini) */}
          <TokenPoolCard onKeyUpdated={handleKeyUpdated} />

          {/* Section 2: Database Places Overview Stats */}
          <PlaceStatsCard
            stats={stats}
            loading={loadingStats}
            onRefresh={loadStats}
          />

          {/* Section 3: Batch Enrichment Runner & Progress Monitor */}
          <BatchEnrichmentCard onJobFinished={loadStats} />
        </div>
      </div>
    </div>
  );
}
