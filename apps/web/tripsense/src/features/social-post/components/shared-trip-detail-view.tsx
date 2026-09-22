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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useTranslation } from "@/i18n";
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
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "PUBLIC", label: "Công khai", icon: Globe2 },
  { value: "UNLISTED", label: "Có liên kết", icon: Eye },
  { value: "PRIVATE", label: "Chỉ mình tôi", icon: Lock },
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
function dateRange(start?: string, end?: string) {
  return start && end ? `${start} – ${end}` : start || end || "Ngày đi được ẩn";
}
function visibilityLabel(value?: Visibility) {
  return (
    visibilityOptions.find((item) => item.value === value)?.label || "Công khai"
  );
}

function getLocalizedPublicItemTitle(
  item: { title: string; type: string },
  t: (key: string, def?: string) => string,
): string {
  if (
    item.type === "HOTEL" &&
    (item.title === "Nơi lưu trú" || item.title === "HOTEL")
  ) {
    return t("trip.hotel", "Nơi lưu trú");
  }
  if (
    item.type === "FLIGHT" &&
    (item.title === "Di chuyển bằng máy bay" || item.title === "FLIGHT")
  ) {
    return t("trip.flight", "Di chuyển bằng máy bay");
  }
  if (
    item.type === "TRANSFER" &&
    (item.title === "Di chuyển" || item.title === "TRANSFER")
  ) {
    return t("trip.transfer", "Di chuyển");
  }
  return item.title;
}

export function SharedTripDetailView({
  post,
  detail,
  onUpdated,
}: SharedTripDetailViewProps) {
  const { t } = useTranslation();
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
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể cập nhật bài viết.",
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể tạo bản xem trước mới.",
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể cập nhật bản chia sẻ.",
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
              <h2 className="font-black">{post.author.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {visibilityLabel(post.visibility)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Bản sao hành trình
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
              <Edit3 className="h-4 w-4" /> Chỉnh sửa
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
              {visibilityOptions.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${visibility === value ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" /> Hủy
              </Button>
              <Button onClick={save} disabled={saving}>
                <Check className="h-4 w-4" /> {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-5 whitespace-pre-line text-base leading-7">
            {post.content || "Hành trình này được chia sẻ từ My Trips."}
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
            Chưa có ảnh bìa
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute left-5 top-5 flex gap-2">
          <Badge className="rounded-full bg-background text-foreground hover:bg-background">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Bản sao an toàn
          </Badge>
        </div>
        <div className="absolute bottom-7 left-6 right-6 text-white">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
            <MapPin className="h-4 w-4" />
            {publicSummary?.destinationName || trip.destinationName}
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">
            {publicSummary?.name || trip.name}
          </h1>
        </div>
      </section>

      <section className="p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            icon={CalendarDays}
            label="Thời gian"
            value={`${publication?.datePrecision === "EXACT" ? dateRange(trip.startDate, trip.endDate) : "Ngày đi được ẩn"} · ${publicSummary?.dayCount ?? trip.dayCount ?? 0} ngày`}
          />
          <Stat
            icon={MapPin}
            label="Điểm đến"
            value={publicSummary?.destinationName || trip.destinationName}
          />
          <Stat
            icon={Route}
            label="Hoạt động công khai"
            value={`${publicSummary?.itineraryItemCount ?? trip.itineraryItemCount ?? 0} mục`}
          />
        </div>
        {publication ? (
          <div className="mt-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">Lịch trình công khai</h3>
                <p className="text-sm text-muted-foreground">
                  Bản đã đóng băng · revision {publication.publicationRevision}
                </p>
              </div>
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
                  Cập nhật bản chia sẻ
                </Button>
              )}
            </div>
            <div className="mt-5 space-y-6">
              {publication.days.map((day) => (
                <section
                  key={day.dayNumber}
                  className="relative border-l-2 border-primary/20 pl-6"
                >
                  <span className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                    {day.dayNumber}
                  </span>
                  <h4 className="font-black">
                    Ngày {day.dayNumber}
                    {day.date ? ` · ${day.date}` : ""}
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
                              <p className="font-black">
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
                                ? ` · ${item.durationMinutes} phút`
                                : ""}
                            </p>
                          )}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Không có hoạt động công khai trong ngày này.
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
              <p className="font-bold">Bài chia sẻ cũ chỉ có bản tóm tắt</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Chủ bài viết cần xem trước và tái xuất bản để có timeline an
                toàn.
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
                  Xem trước để tái xuất bản
                </Button>
              )}
            </div>
          </div>
        )}
        {managementPreview && (
          <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
            <p className="text-xs font-black uppercase tracking-wider text-primary">
              Xác nhận bản cập nhật
            </p>
            <h3 className="mt-1 font-black">
              {managementPreview.snapshot.summary.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {managementPreview.snapshot.summary.dayCount} ngày ·{" "}
              {managementPreview.snapshot.summary.itineraryItemCount} hoạt động
              · revision {managementPreview.snapshot.publicationRevision}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setManagementPreview(null)}
              >
                Hủy
              </Button>
              <Button onClick={confirmRefresh} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}{" "}
                Xác nhận cập nhật
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>
        )}
        <div className="mt-6">
          <h3 className="font-black">Điểm nhấn hành trình</h3>
          {trip.highlights?.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {trip.highlights.map((item, index) => (
                <div
                  key={`${item.dayNumber}-${item.title}-${index}`}
                  className="rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <p className="text-xs font-bold text-primary">
                    Ngày {item.dayNumber}
                  </p>
                  <p className="mt-1 font-bold">
                    {item.placeName || getLocalizedPublicItemTitle(item, t)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa có điểm nhấn công khai.
            </p>
          )}
        </div>
        <div className="mt-6 flex gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-bold">Nội dung riêng tư đã được loại bỏ</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Trang này không hiển thị ghi chú, ngân sách, người tham gia, thông
              tin đặt chỗ, địa chỉ chi tiết hoặc tọa độ. Đây là bản đã đóng
              băng: sửa, lưu trữ hoặc xóa chuyến đi gốc không tự thay đổi bài
              Community; chủ bài phải cập nhật hoặc xóa bài riêng. Bản đồ được
              tạm hoãn cho đến khi có Place ID công khai an toàn.
            </p>
          </div>
        </div>
      </section>
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
      <p className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </p>
      <p className="mt-2 font-black">{value}</p>
    </div>
  );
}
