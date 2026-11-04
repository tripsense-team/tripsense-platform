"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Edit3,
  Eye,
  Globe2,
  Loader2,
  Lock,
  MapPin,
  RefreshCw,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { ImportCommunityTripDialog } from "./import-community-trip-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useTranslation } from "@/i18n";
import type { I18nContextValue } from "@/i18n/i18n-context";
import { socialPostRepository } from "../services";
import type {
  SocialPost,
  TripShareDetailResponse,
  TripSharePreviewResponse,
} from "../types";

type Visibility = NonNullable<SocialPost["visibility"]>;
interface SharedTripDetailViewProps {
  post: SocialPost;
  detail: TripShareDetailResponse | null;
  onUpdated?: () => void;
}

const visibilityOptions: Array<{
  value: Visibility;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "PUBLIC", labelKey: "social.tripShareVisibilityPublic", icon: Globe2 },
  { value: "UNLISTED", labelKey: "social.tripShareVisibilityUnlisted", icon: Eye },
  { value: "PRIVATE", labelKey: "social.tripShareVisibilityPrivate", icon: Lock },
];

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "TS"
  );
}
function dateRange(start: string | undefined, end: string | undefined, locale: string, hidden: string) {
  if (!start && !end) return hidden;
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const value = (date?: string) => date ? format.format(new Date(`${date}T00:00:00`)) : null;
  return start && end ? `${value(start)} – ${value(end)}` : value(start) || value(end) || hidden;
}
function visibilityLabel(value: Visibility | undefined, t: (key: string) => string) {
  return t(visibilityOptions.find((item) => item.value === value)?.labelKey || "social.tripShareVisibilityPublic");
}

function getLocalizedPublicItemTitle(
  item: { title: string; type?: string },
  t: I18nContextValue["t"],
): string {
  if (
    item.type === "HOTEL" &&
    (item.title === "Nơi lưu trú" || item.title === "HOTEL")
  ) {
    return t("trip.hotel");
  }
  if (
    item.type === "FLIGHT" &&
    (item.title === "Di chuyển bằng máy bay" || item.title === "FLIGHT")
  ) {
    return t("trip.flight");
  }
  if (
    item.type === "TRANSFER" &&
    (item.title === "Di chuyển" || item.title === "TRANSFER")
  ) {
    return t("trip.transfer");
  }
  return item.title;
}

export function SharedTripDetailView({
  post,
  detail,
  onUpdated,
}: SharedTripDetailViewProps) {
  const { locale, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const trip = post.trip;
  const [editing, setEditing] = React.useState(false);
  const [caption, setCaption] = React.useState(post.content || "");
  const [visibility, setVisibility] = React.useState<Visibility>(
    post.visibility || "PUBLIC",
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [managementPreview, setManagementPreview] =
    React.useState<TripSharePreviewResponse | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  if (!trip) return null;
  const owner = user?.id === post.author.id;
  const publication = detail?.publication;
  const publicSummary = publication?.summary;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (caption !== (post.content || ""))
        await socialPostRepository.updatePostContent(post.id, {
          content: caption,
        });
      if (visibility !== (post.visibility || "PUBLIC"))
        await socialPostRepository.updatePostVisibility(post.id, visibility);
      setEditing(false);
      onUpdated?.();
    } catch {
      setError(
        t("social.tripShareUpdateFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function previewLatest() {
    if (!detail?.sourceTripId) return;
    setPreviewing(true);
    setError(null);
    try {
      setManagementPreview(
        await socialPostRepository.previewTripShare(detail.sourceTripId),
      );
    } catch {
      setError(
        t("social.tripSharePreviewFailed"),
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmRefresh() {
    if (!managementPreview) return;
    setRefreshing(true);
    setError(null);
    try {
      await socialPostRepository.refreshTripSharePublication(
        post.id,
        {
          expectedSnapshotFingerprint: managementPreview.snapshotFingerprint,
          consentVersion: managementPreview.consentVersion,
        },
        crypto.randomUUID(),
      );
      setManagementPreview(null);
      onUpdated?.();
    } catch {
      setError(
        t("social.tripShareRefreshFailed"),
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <section className="border-b border-border p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11 sm:h-[46px] sm:w-[46px]">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{initials(post.author.name)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="font-bold">{post.author.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {visibilityLabel(post.visibility, t)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("social.tripShareSnapshotLabel")}
                </span>
              </div>
            </div>
          </div>
          {owner && !editing && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setEditing(true)}
            >
              <Edit3 className="h-4 w-4" /> {t("social.tripShareEdit")}
            </Button>
          )}
        </div>
        {editing ? (
          <div className="mt-5 space-y-4">
            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={5000}
              className="min-h-28 rounded-xl"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {visibilityOptions.map(({ value, labelKey, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${visibility === value ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  <Icon className="h-4 w-4" />
                  {t(labelKey)}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> {t("social.tripShareCancel")}
              </Button>
              <Button onClick={save} disabled={saving}>
                <Check className="h-4 w-4" /> {t(saving ? "social.tripShareSaving" : "social.tripShareSave")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-5 whitespace-pre-line text-base leading-7">
            {post.content || t("social.tripShareDefaultCaption")}
          </p>
        )}
      </section>

      <section className="relative min-h-80 overflow-hidden bg-muted">
        {publicSummary?.coverImageUrl || trip.coverImageUrl ? (
          <Image
            src={publicSummary?.coverImageUrl || trip.coverImageUrl || ""}
            alt={publicSummary?.name || trip.name}
            fill
            sizes="(max-width: 768px) 100vw, 1100px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            {t("social.tripShareCoverMissing")}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute left-5 top-5 flex gap-2">
          <Badge className="rounded-full bg-background text-foreground hover:bg-background">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> {t("social.tripShareSafeCopy")}
          </Badge>
        </div>
        <div className="absolute bottom-7 left-6 right-6 text-white">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <MapPin className="h-4 w-4" />
            {publicSummary?.destinationName || trip.destinationName}
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">
            {publicSummary?.name || trip.name}
          </h1>
        </div>
      </section>

      <section className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={CalendarDays}
            label={t("social.tripShareDurationLabel")}
            value={`${publication?.datePrecision === "EXACT" ? dateRange(trip.startDate, trip.endDate, locale, t("social.tripShareDatesHidden")) : t("social.tripShareDatesHidden")} · ${t("social.tripShareDaysCount", { count: publicSummary?.dayCount ?? trip.dayCount ?? 0 })}`}
          />
          <Stat
            icon={MapPin}
            label={t("social.tripShareDestinationLabel")}
            value={publicSummary?.destinationName || trip.destinationName}
          />
          <Stat
            icon={Route}
            label={t("social.tripSharePublicActivitiesLabel")}
            value={t("social.tripShareItemsCount", { count: publicSummary?.itineraryItemCount ?? trip.itineraryItemCount ?? 0 })}
          />
        </div>
        {publication ? (
          <div className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{t("social.tripSharePublicItinerary")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("social.tripShareFrozenRevision", { revision: publication.publicationRevision })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="rounded-full gap-1.5"
                  onClick={() => setImportOpen(true)}
                >
                  <Route className="h-4 w-4" /> {t("social.importTripAction")}
                </Button>
                {detail?.canManagePublication && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={previewLatest}
                    disabled={previewing}
                  >
                    {previewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}{" "}
                    {t("social.tripShareRefresh")}
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-6">
              {publication.days.map((day) => (
                <section
                  key={day.dayNumber}
                  className="relative border-l-2 border-primary/20 pl-6"
                >
                  <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {day.dayNumber}
                  </span>
                  <h4 className="font-bold">
                    {t("social.tripShareDayLabel", { count: day.dayNumber })}
                    {day.date ? ` · ${dateRange(day.date, day.date, locale, "")}` : ""}
                  </h4>
                  <div className="mt-3 space-y-2">
                    {day.items.length ? (
                      day.items.map((item) => (
                        <article
                          key={`${day.dayNumber}-${item.order}`}
                          className="rounded-2xl border border-border bg-background p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-bold">
                                {item.order}. {getLocalizedPublicItemTitle(item, t)}
                              </p>
                              {item.placeName && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.placeName}
                                </p>
                              )}
                            </div>
                            <Badge variant="secondary">{item.type}</Badge>
                          </div>
                          {(item.startTime || item.durationMinutes) && (
                            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              {item.startTime?.slice(0, 5)}
                              {item.endTime
                                ? ` – ${item.endTime.slice(0, 5)}`
                                : ""}
                              {item.durationMinutes
                                ? ` · ${t("social.tripShareMinutes", { count: item.durationMinutes })}`
                                : ""}
                            </p>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("social.tripShareNoActivities")}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">{t("social.tripShareSummaryOnlyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("social.tripShareSummaryOnlyDescription")}
              </p>
              {detail?.canManagePublication && (
                <Button
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={previewLatest}
                  disabled={previewing}
                >
                  {previewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}{" "}
                  {t("social.tripSharePreviewRepublish")}
                </Button>
              )}
            </div>
          </div>
        )}
        {managementPreview && (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {t("social.tripShareConfirmUpdate")}
            </p>
            <h3 className="mt-1 font-bold">
              {managementPreview.snapshot.summary.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("social.tripShareUpdateSummary", {
                days: managementPreview.snapshot.summary.dayCount,
                items: managementPreview.snapshot.summary.itineraryItemCount,
                revision: managementPreview.snapshot.publicationRevision,
              })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setManagementPreview(null)}
              >
                {t("social.tripShareCancel")}
              </Button>
              <Button onClick={confirmRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}{" "}
                {t("social.tripShareConfirmUpdateAction")}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>
        )}
        <div className="mt-6">
          <h3 className="font-bold">{t("social.tripShareHighlightsTitle")}</h3>
          {trip.highlights?.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {trip.highlights.map((item, index) => (
                <div
                  key={`${item.dayNumber}-${item.title}-${index}`}
                  className="rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <p className="text-xs font-bold text-primary">
                    {t("social.tripShareDayLabel", { count: item.dayNumber })}
                  </p>
                  <p className="mt-1 font-bold">
                    {item.placeName || getLocalizedPublicItemTitle(item, t)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("social.tripShareNoHighlights")}
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-bold">{t("social.tripSharePrivacyRemovedTitle")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("social.tripSharePrivacyRemovedDescription")}
            </p>
          </div>
        </div>
      </section>
      <ImportCommunityTripDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        postId={post.id}
        defaultName={t("social.importTripDefaultName", {
          name: publicSummary?.name || trip.name,
        })}
        dayCount={publicSummary?.dayCount ?? trip.dayCount ?? 1}
      />
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </p>
      <p className="mt-2 font-bold">{value}</p>
    </div>
  );
}
