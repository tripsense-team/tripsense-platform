"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { socialPostRepository } from "../services";
import type { CommunityReportReason } from "../types";
import { useTranslation } from "@/i18n";

export function ReportPostDialog({
  postId,
  commentId,
  open,
  onOpenChange,
}: {
  postId: string;
  commentId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = React.useState<CommunityReportReason>("SPAM");
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const reasons: Array<{ value: CommunityReportReason; label: string }> = [
    { value: "SPAM", label: t("social.reportSpam") },
    { value: "HARASSMENT", label: t("social.reportHarassment") },
    { value: "DANGEROUS_CONTENT", label: t("social.reportDangerous") },
    { value: "PRIVACY", label: t("social.reportPrivacy") },
    { value: "MISINFORMATION", label: t("social.reportMisinformation") },
    { value: "OTHER", label: t("social.reportOther") },
  ];

  const isSubmittingRef = React.useRef(false);

  async function submit() {
    if (isSubmittingRef.current || submitting) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { reason, details: details.trim() || undefined };
      if (commentId) {
        await socialPostRepository.submitCommentReport(
          postId,
          commentId,
          payload,
        );
      } else {
        await socialPostRepository.submitPostReport(postId, payload);
      }
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("errors.generic"));
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      window.setTimeout(() => {
        setSubmitted(false);
        setError(null);
        setDetails("");
        setReason("SPAM");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {commentId ? t("social.reportComment") : t("social.reportPost")}
          </DialogTitle>
          <DialogDescription>{t("social.reportDescription")}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="rounded-2xl bg-emerald-500/10 p-5 text-sm text-emerald-700 dark:text-emerald-300">
            <p className="font-bold">{t("social.reportSubmitted")}</p>
            <p className="mt-1">{t("social.reportSubmittedDesc")}</p>
            <Button
              className="mt-4 rounded-full"
              onClick={() => handleOpenChange(false)}
            >
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="report-reason"
                className="mb-1.5 block text-sm font-bold"
              >
                {t("social.reportReason")}
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as CommunityReportReason)
                }
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="report-details"
                className="mb-1.5 block text-sm font-bold"
              >
                {t("social.reportDetails")}
              </label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={500}
                className="min-h-28 rounded-xl"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={submit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}{" "}
                {t("social.reportSubmit")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
