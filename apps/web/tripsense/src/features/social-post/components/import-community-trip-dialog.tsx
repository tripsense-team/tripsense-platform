"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Route, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { importCommunityTrip } from "@/features/trip-management/services/trip-management-api";
import { useTranslation } from "@/i18n";
import { ApiError } from "@/services/api-client";

interface ImportCommunityTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  defaultName: string;
  dayCount: number;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function inclusiveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function importErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return "social.importTripErrorGeneric";
  if (error.status === 401) return "social.importTripErrorAuth";
  if (error.status === 404) return "social.importTripErrorNotFound";
  if (error.status === 409) return "social.importTripErrorConflict";
  if (error.status === 422) return "social.importTripErrorInvalid";
  if (error.status === 429) return "social.importTripErrorRateLimited";
  if (error.status === 503) return "social.importTripErrorUnavailable";
  return "social.importTripErrorGeneric";
}

export function ImportCommunityTripDialog({
  open,
  onOpenChange,
  postId,
  defaultName,
  dayCount,
}: ImportCommunityTripDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = React.useState(defaultName);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const idempotencyKey = React.useRef(crypto.randomUUID());

  function resetForm() {
    setName(defaultName);
    setStartDate("");
    setEndDate("");
    setError(null);
    idempotencyKey.current = crypto.randomUUID();
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  function changeStartDate(value: string) {
    setStartDate(value);
    setEndDate(value ? addDays(value, Math.max(0, dayCount - 1)) : "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim() || !startDate || !endDate) {
      setError(t("social.importTripRequiredFields"));
      return;
    }
    if (inclusiveDays(startDate, endDate) !== dayCount) {
      setError(t("social.importTripDateMismatch", { count: dayCount }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await importCommunityTrip(
        postId,
        { name: name.trim(), startDate, endDate },
        idempotencyKey.current,
      );
      changeOpen(false);
      router.push(`/trips/${result.tripId}`);
    } catch (cause) {
      setError(t(importErrorKey(cause)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t("social.importTripTitle")}</DialogTitle>
            <DialogDescription>
              {t("social.importTripDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t("social.importTripPrivacyTitle")}
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {t("social.importTripPrivacyDescription")}
              </p>
            </div>

            <label className="block space-y-1.5 text-sm font-medium">
              <span>{t("trip.tripName")}</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={160}
                autoFocus
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("trip.startDate")}</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => changeStartDate(event.target.value)}
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium">
                <span>{t("trip.endDate")}</span>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </label>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {t("social.importTripDuration", { count: dayCount })}
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Route className="h-4 w-4" />
              )}
              {t("social.importTripAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
