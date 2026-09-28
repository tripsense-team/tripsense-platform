"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import type { BatchEnrichmentProgress } from "../types";
import {
  startBatchEnrichment,
  fetchBatchProgress,
  cancelBatchEnrichment,
} from "../services/settings-api";

interface BatchEnrichmentCardProps {
  onJobFinished: () => void;
}

export function BatchEnrichmentCard({ onJobFinished }: BatchEnrichmentCardProps) {
  const { t } = useTranslation();

  const [concurrency, setConcurrency] = useState(5);
  const [forceAll, setForceAll] = useState(false);
  const [syncEmbedding, setSyncEmbedding] = useState(true);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<BatchEnrichmentProgress | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Poll progress function
  const poll = async () => {
    try {
      const data = await fetchBatchProgress();
      setProgress(data);

      if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED") {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        onJobFinished();
      }
    } catch {
      // Ignore transient polling errors
    }
  };

  // Initial poll on mount
  useEffect(() => {
    poll();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Maintain polling while running
  useEffect(() => {
    if (progress?.status === "RUNNING") {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(poll, 1200);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [progress?.status]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await startBatchEnrichment({
        concurrency,
        limit: 1500,
        forceAll,
      });
      setProgress(res);
      pollTimerRef.current = setInterval(poll, 1200);
    } catch (err) {
      console.error("Failed to start batch enrichment:", err);
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelBatchEnrichment();
      await poll();
    } catch (err) {
      console.error("Failed to cancel batch enrichment:", err);
    } finally {
      setCancelling(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isRunning = progress?.status === "RUNNING";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t("settings.batchCard.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("settings.batchCard.description")}</p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>{t("settings.batchCard.jobRunning")}</span>
            </span>
          ) : progress?.status === "COMPLETED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{t("settings.batchCard.jobCompleted")}</span>
            </span>
          ) : progress?.status === "FAILED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Đã dừng (Hết token / Lỗi)</span>
            </span>
          ) : progress?.status === "CANCELLED" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Square className="h-3.5 w-3.5" />
              <span>Đã hủy</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span>{t("settings.batchCard.jobIdle")}</span>
            </span>
          )}
        </div>
      </div>

      {/* Control Configuration */}
      <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-border/50 bg-background/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Concurrency Selector */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>{t("settings.batchCard.concurrency")}</span>
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            {[1, 3, 5, 8].map((val) => (
              <button
                key={val}
                type="button"
                disabled={isRunning}
                onClick={() => setConcurrency(val)}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition ${
                  concurrency === val
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-accent hover:text-foreground"
                } disabled:opacity-50`}
              >
                {val} {val === 5 ? "⭐" : ""}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("settings.batchCard.concurrencyHelp")}</p>
        </div>

        {/* Options Checkboxes */}
        <div className="flex flex-col justify-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={syncEmbedding}
              onChange={(e) => setSyncEmbedding(e.target.checked)}
              disabled={isRunning}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <span>{t("settings.batchCard.syncEmbeddingLabel")}</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={forceAll}
              onChange={(e) => setForceAll(e.target.checked)}
              disabled={isRunning}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <span>{t("settings.batchCard.forceAllLabel")}</span>
          </label>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end sm:col-span-2 lg:col-span-1">
          {isRunning ? (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50 lg:w-auto"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span>{t("settings.batchCard.cancelJob")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-purple-600 px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-50 lg:w-auto"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              <span>{t("settings.batchCard.startEnrichment")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress & Live Telemetry View */}
      {progress && progress.total > 0 && (
        <div className="mt-5 space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{t("settings.batchCard.progress")}</span>
              <span className="font-mono font-bold text-primary">
                {progress.percentage.toFixed(1)}% ({progress.processed}/{progress.total})
              </span>
            </div>
            <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-muted/60 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-purple-500 to-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${Math.max(2, progress.percentage)}%` }}
              />
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 text-center">
              <span className="text-[11px] text-muted-foreground">{t("settings.batchCard.processed")}</span>
              <div className="font-mono text-sm font-bold text-foreground">
                {progress.processed} / {progress.total}
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {t("settings.batchCard.success")}
              </span>
              <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {progress.success}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 text-center">
              <span className="text-[11px] text-muted-foreground">{t("settings.batchCard.elapsed")}</span>
              <div className="font-mono text-sm font-bold text-foreground">
                {formatTime(progress.elapsedSeconds)}
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 text-center">
              <span className="text-[11px] text-muted-foreground">{t("settings.batchCard.remaining")}</span>
              <div className="font-mono text-sm font-bold text-foreground">
                {isRunning ? formatTime(progress.estimatedRemainingSeconds) : "00:00"}
              </div>
            </div>
          </div>

          {/* Currently Processing Place */}
          {isRunning && progress.currentPlaceName && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-primary">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              <span>
                {t("settings.batchCard.currentPlace")}:{" "}
                <span className="font-semibold text-foreground">
                  {progress.currentPlaceName}
                </span>
              </span>
            </div>
          )}

          {/* Real-time Activity Terminal Log Viewer */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner">
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3 py-2 text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <Terminal className="ml-2 h-3.5 w-3.5" />
                <span className="font-mono text-[11px] font-medium">{t("settings.batchCard.logsTitle")}</span>
              </div>
              <span className="font-mono text-xs text-zinc-500">
                {progress.recentLogs.length} events
              </span>
            </div>

            <div
              ref={logContainerRef}
              className="max-h-48 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed select-text"
            >
              {progress.recentLogs.length === 0 ? (
                <div className="text-zinc-600 italic">No events recorded yet...</div>
              ) : (
                progress.recentLogs.map((log, idx) => {
                  let colorClass = "text-zinc-300";
                  if (log.includes("[FATAL]")) {
                    colorClass = "text-rose-400 font-bold bg-rose-500/10 border-l-2 border-rose-500 pl-2";
                  } else if (log.includes("Enriched") || log.includes("FINISHED")) {
                    colorClass = "text-emerald-400";
                  } else if (log.includes("[WARN]")) {
                    colorClass = "text-amber-400";
                  } else if (log.includes("[ERROR]")) {
                    colorClass = "text-red-400";
                  } else if (log.includes("started")) {
                    colorClass = "text-cyan-400 font-semibold";
                  }

                  return (
                    <div key={idx} className={`${colorClass} hover:bg-zinc-900/50 py-0.5 px-1 rounded`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
