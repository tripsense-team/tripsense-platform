"use client";

import * as React from "react";
import { ImageIcon, Loader2, Play, RefreshCw, ScanSearch } from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  fetchPlaceMediaBackfill,
  fetchPlaceMediaCoverage,
  startPlaceMediaBackfill,
} from "../services/settings-api";
import type { PlaceMediaBackfillJob, PlaceMediaCoverage } from "../types";

export function PlaceMediaCoverageCard() {
  const { t } = useTranslation();
  const [coverage, setCoverage] = React.useState<PlaceMediaCoverage | null>(null);
  const [job, setJob] = React.useState<PlaceMediaBackfillJob | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setCoverage(await fetchPlaceMediaCoverage());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!job || !["QUEUED", "RUNNING"].includes(job.status)) return;
    const timer = window.setInterval(() => {
      void fetchPlaceMediaBackfill(job.id).then(setJob).catch(() => setError(true));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [job]);

  const start = async (dryRun: boolean) => {
    setLoading(true);
    setError(false);
    try {
      const next = await startPlaceMediaBackfill(dryRun);
      setJob(next);
      if (next.status === "COMPLETED") await load();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const counts = coverage?.counts;
  const active = job && ["QUEUED", "RUNNING"].includes(job.status);

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold">{t("settings.mediaCoverage.title")}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("settings.mediaCoverage.description")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("settings.mediaCoverage.refresh")}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {(["READY", "PENDING", "DEGRADED", "UNAVAILABLE", "RIGHTS_BLOCKED", "REVIEW_REQUIRED"] as const).map((state) => (
          <div key={state} className="rounded-xl border bg-background/60 p-3">
            <div className="text-xl font-semibold">{counts?.[state] ?? "—"}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {t(`settings.mediaCoverage.states.${state}`)}
            </div>
          </div>
        ))}
      </div>

      {job && (
        <div className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm" role="status">
          {t("settings.mediaCoverage.jobProgress", {
            processed: job.processed,
            total: job.total,
            success: job.succeeded,
            failed: job.failed,
          })}
          {job.lastReasonCode === "PROVIDER_PERSISTENCE_RIGHTS_NOT_APPROVED" && (
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              {t("settings.mediaCoverage.rightsBlocked")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {t("settings.mediaCoverage.loadFailed")}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void start(true)}
          disabled={loading || Boolean(active)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium disabled:opacity-50"
        >
          <ScanSearch className="h-4 w-4" />
          {t("settings.mediaCoverage.audit")}
        </button>
        <button
          type="button"
          onClick={() => void start(false)}
          disabled={loading || Boolean(active)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {t("settings.mediaCoverage.backfill")}
        </button>
      </div>
    </section>
  );
}
