"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog, ErrorState } from "@/components/shared";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { socialPostRepository } from "../services";
import type { ModerationReport } from "../types";

export function CommunityModerationScreen() {
  const { t, locale } = useTranslation();
  const [reports, setReports] = React.useState<ModerationReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actingId, setActingId] = React.useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] =
    React.useState<ModerationReport | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(
        (await socialPostRepository.listModerationReports("PENDING")).items,
      );
    } catch (cause) {
      setError(
        getSafeErrorMessage(
          cause,
          t("social.moderationLoadFailed"),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function decide(
    report: ModerationReport,
    action: "DISMISS" | "REMOVE_CONTENT",
  ) {
    setActingId(report.id);
    setError(null);
    try {
      await socialPostRepository.decideModerationReport(report.id, action);
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (cause) {
      setError(
        getSafeErrorMessage(
          cause,
          t("social.moderationFailed"),
        ),
      );
      throw cause;
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-primary">
          <ShieldAlert className="h-4 w-4" /> {t("social.moderation")}
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {t("social.moderationQueueTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("social.moderationAuditNotice")}
        </p>
      </header>
      {error && (
        <div className="mt-5">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}
      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />{" "}
          {t("social.moderationLoading")}
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-3 font-black">
            {t("social.moderationEmpty")}
          </h2>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {reports.map((report) => (
            <article
              key={report.id}
              className="rounded-3xl border border-border bg-card p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex gap-2">
                    <Badge>{report.targetType}</Badge>
                    <Badge variant="secondary">{report.reason}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {report.details || t("social.moderationNoDetails")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reporter: {report.reporterId} ·{" "}
                    {new Date(report.createdAt).toLocaleString(
                      locale === "vi" ? "vi-VN" : "en-US",
                    )}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  <Link href={`/community/posts/${report.postId}`}>
                    <ExternalLink className="h-4 w-4" />{" "}
                    {t("social.moderationViewContent")}
                  </Link>
                </Button>
              </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
                <Button
                  variant="ghost"
                  disabled={actingId === report.id}
                  onClick={() =>
                    void decide(report, "DISMISS").catch(() => undefined)
                  }
                >
                  {t("social.moderationDismiss")}
                </Button>
                <Button
                  variant="destructive"
                  disabled={actingId === report.id}
                  onClick={() => setPendingRemoval(report)}
                >
                  {actingId === report.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}{" "}
                  {t("social.moderationRemove")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmationDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={t("social.moderationConfirmDeleteTitle")}
        description={t("social.moderationConfirmDeleteDesc")}
        confirmText={t("social.moderationRemove")}
        cancelText={t("common.cancel")}
        variant="destructive"
        loading={pendingRemoval ? actingId === pendingRemoval.id : false}
        onConfirm={async () => {
          if (pendingRemoval) await decide(pendingRemoval, "REMOVE_CONTENT");
        }}
      />
    </main>
  );
}
