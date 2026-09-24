"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth";
import { useUserProfile } from "@/features/profile";
import { useTripStore } from "@/features/trip-management";
import type { TripResponse } from "@/features/trip-management/types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { useCreatePost } from "../hooks";
import { socialPostRepository } from "../services";
import type {
  SocialPost,
  SocialPostMedia,
  TripSharePreviewResponse,
} from "../types";

interface PostComposerProps {
  onPostCreated?: (post: SocialPost) => void;
  className?: string;
}
type ComposerMode = "update" | "trip";
type ShareVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export function PostComposer({ onPostCreated, className }: PostComposerProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { data: profile } = useUserProfile(user?.id || "");
  const {
    create,
    submitting,
    error,
    feedback,
    dismissFeedback,
    clearError,
    beginNewDraft,
  } = useCreatePost();
  const trips = useTripStore((state) => state.trips);
  const loadingTrips = useTripStore((state) => state.loading);
  const tripListError = useTripStore((state) => state.error);
  const fetchTrips = useTripStore((state) => state.fetchTrips);
  const [mode, setMode] = React.useState<ComposerMode>("update");
  const [content, setContent] = React.useState("");
  const [mediaFiles, setMediaFiles] = React.useState<
    Array<{ file: File; previewUrl: string }>
  >([]);
  const [selectedTripId, setSelectedTripId] = React.useState("");
  const [visibility, setVisibility] = React.useState<ShareVisibility>("PUBLIC");
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [sharingTrip, setSharingTrip] = React.useState(false);
  const [preview, setPreview] = React.useState<TripSharePreviewResponse | null>(
    null,
  );
  const [previewing, setPreviewing] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mediaFilesRef = React.useRef(mediaFiles);
  const displayName = profile?.email?.split("@")[0] || user?.name || "Bạn";
  const avatar = profile?.avatarUrl || user?.avatar;
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("composer") !== "trip")
      return;
    const timeout = window.setTimeout(() => setMode("trip"), 0);
    return () => window.clearTimeout(timeout);
  }, []);
  React.useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);
  React.useEffect(
    () => () =>
      mediaFilesRef.current.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      ),
    [],
  );

  const loadTrips = React.useCallback(
    async (force = false) => {
      try {
        const availableTrips = await fetchTrips(force);
        const requestedTripId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("tripId")
            : null;
        setSelectedTripId((current) => {
          if (current && availableTrips.some((trip) => trip.id === current))
            return current;
          if (
            requestedTripId &&
            availableTrips.some((trip) => trip.id === requestedTripId)
          )
            return requestedTripId;
          return availableTrips[0]?.id || "";
        });
      } catch {
        // Error handled in store
      }
    },
    [fetchTrips],
  );

  React.useEffect(() => {
    if (mode === "trip" && isAuthenticated) {
      void loadTrips(false);
    }
  }, [mode, isAuthenticated, loadTrips]);

  React.useEffect(() => {
    if (trips.length > 0 && !selectedTripId) {
      const requestedTripId =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("tripId")
          : null;
      if (requestedTripId && trips.some((t) => t.id === requestedTripId)) {
        setSelectedTripId(requestedTripId);
      } else {
        setSelectedTripId(trips[0]?.id || "");
      }
    }
  }, [trips, selectedTripId]);

  const loadPreview = React.useCallback(async (tripId: string) => {
    if (!tripId) return;
    setPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    try {
      setPreview(await socialPostRepository.previewTripShare(tripId));
    } catch (cause) {
      setPreviewError(
        cause instanceof Error
          ? cause.message
          : "Không thể tạo bản xem trước công khai.",
      );
    } finally {
      setPreviewing(false);
    }
  }, []);

  React.useEffect(() => {
    if (mode !== "trip" || !selectedTripId) return;
    const timeout = window.setTimeout(
      () => void loadPreview(selectedTripId),
      0,
    );
    return () => window.clearTimeout(timeout);
  }, [loadPreview, mode, selectedTripId]);

  function changeMode(nextMode: ComposerMode) {
    setMode(nextMode);
    setPreviewError(null);
    clearError();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 10 - mediaFiles.length));
    beginNewDraft();
    setMediaFiles((current) => [
      ...current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
    event.target.value = "";
  }

  function removeMedia(index: number) {
    setMediaFiles((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadMedia(): Promise<SocialPostMedia[]> {
    if (!mediaFiles.length) return [];
    if (process.env.NEXT_PUBLIC_USE_SOCIAL_POST_MOCK === "true")
      return mediaFiles.map(({ file, previewUrl }, sortOrder) => ({
        publicId: `mock/${file.name}`,
        secureUrl: previewUrl,
        resourceType: "image",
        format: file.type.split("/")[1] || "jpg",
        width: 1,
        height: 1,
        sortOrder,
      }));
    const signature = await socialPostRepository.getUploadSignature();
    return Promise.all(
      mediaFiles.map(async ({ file }, sortOrder) => {
        const body = new FormData();
        body.set("file", file);
        body.set("api_key", signature.apiKey);
        body.set("timestamp", String(signature.timestamp));
        body.set("signature", signature.signature);
        body.set("folder", signature.folder);
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
          { method: "POST", body },
        );
        if (!response.ok) throw new Error("Upload ảnh thất bại.");
        const data = await response.json();
        return {
          publicId: data.public_id,
          secureUrl: data.secure_url,
          resourceType: "image" as const,
          format: data.format,
          width: data.width,
          height: data.height,
          sortOrder,
        };
      }),
    );
  }

  const isSubmittingRef = React.useRef(false);
  const [isPosting, setIsPosting] = React.useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = React.useState(false);

  async function submitUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmittingRef.current || pending || isPosting || isUploadingMedia)
      return;
    if (!content.trim() && !mediaFiles.length) return;

    isSubmittingRef.current = true;
    setIsPosting(true);
    clearError();

    try {
      let mediaPayload: SocialPostMedia[] = [];
      if (mediaFiles.length > 0) {
        setIsUploadingMedia(true);
        mediaPayload = await uploadMedia();
        setIsUploadingMedia(false);
      }
      const post = await create({
        content: content.trim(),
        media: mediaPayload,
      });
      setContent("");
      mediaFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setMediaFiles([]);
      onPostCreated?.(post);
    } catch {
      /* Hook displays the API error. */
    } finally {
      isSubmittingRef.current = false;
      setIsPosting(false);
      setIsUploadingMedia(false);
    }
  }

  async function submitTrip(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmittingRef.current || sharingTrip || pending || isPosting) return;
    if (!selectedTripId || !preview) return;

    isSubmittingRef.current = true;
    setSharingTrip(true);
    setPreviewError(null);

    try {
      const post = await socialPostRepository.createTripShare(
        {
          tripId: selectedTripId,
          caption: content.trim() || undefined,
          visibility,
          expectedSnapshotFingerprint: preview.snapshotFingerprint,
          consentVersion: preview.consentVersion,
        },
        crypto.randomUUID(),
      );
      setContent("");
      setSuccessMessage("Hành trình đã được chia sẻ bằng bản sao an toàn.");
      onPostCreated?.(post);
    } catch (cause) {
      setPreviewError(
        cause instanceof Error
          ? cause.message
          : "Không thể chia sẻ hành trình.",
      );
    } finally {
      isSubmittingRef.current = false;
      setSharingTrip(false);
    }
  }

  const pending =
    mode === "update"
      ? submitting || isPosting || isUploadingMedia
      : sharingTrip;
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-border bg-card shadow-sm",
        className,
      )}
      aria-label="Tạo bài viết"
    >
      {(feedback || successMessage) && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="flex-1">{successMessage || feedback?.message}</span>
          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              dismissFeedback();
            }}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 border-b border-border bg-muted/30 p-1.5">
        <button
          type="button"
          onClick={() => changeMode("update")}
          disabled={pending}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
            mode === "update"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="h-4 w-4" /> {t("social.postTypeUpdate")}
        </button>
        <button
          type="button"
          onClick={() => changeMode("trip")}
          disabled={pending}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition",
            mode === "trip"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Compass className="h-4 w-4" /> {t("social.shareTrip")}
        </button>
      </div>
      <form
        onSubmit={mode === "update" ? submitUpdate : submitTrip}
        className="p-5"
      >
        <div className="flex gap-3">
          <Avatar className="h-11 w-11 sm:h-[46px] sm:w-[46px] shrink-0">
            <AvatarImage src={avatar} alt={displayName} />
            <AvatarFallback>{initials || "TS"}</AvatarFallback>
          </Avatar>
          <Textarea
            value={content}
            onChange={(event) => {
              beginNewDraft();
              setContent(event.target.value);
            }}
            maxLength={5000}
            disabled={pending}
            placeholder={
              mode === "update"
                ? "Chia sẻ một khoảnh khắc, kinh nghiệm hoặc câu hỏi du lịch..."
                : "Viết vài dòng giới thiệu về hành trình này..."
            }
            className="min-h-24 resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
        {mode === "trip" && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-[1fr_11rem]">
            <div>
              <label
                htmlFor="community-trip"
                className="mb-1.5 block text-xs font-bold"
              >
                Chuyến đi từ My Trips
              </label>
              {loadingTrips ? (
                <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tải...
                </div>
              ) : tripListError ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                  <span>Không thể tải My Trips.</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadTrips(true)}
                    className="h-8 rounded-full"
                  >
                    Thử lại
                  </Button>
                </div>
              ) : trips.length ? (
                <select
                  id="community-trip"
                  value={selectedTripId}
                  onChange={(event) => {
                    setSelectedTripId(event.target.value);
                    setPreview(null);
                  }}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.name} · {trip.destinationName}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa có chuyến đi.{" "}
                  <Link href="/trips/new" className="font-bold text-primary">
                    Tạo chuyến đi
                  </Link>
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="community-visibility"
                className="mb-1.5 block text-xs font-bold"
              >
                Ai có thể xem?
              </label>
              <select
                id="community-visibility"
                value={visibility}
                onChange={(event) =>
                  setVisibility(event.target.value as ShareVisibility)
                }
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
              >
                <option value="PUBLIC">Công khai</option>
                <option value="UNLISTED">Có liên kết</option>
                <option value="PRIVATE">Chỉ mình tôi</option>
              </select>
            </div>
            <p className="sm:col-span-2 text-xs leading-relaxed text-muted-foreground">
              TripSense đăng một bản sao an toàn. Ghi chú riêng, ngân sách,
              người tham gia, tọa độ và thông tin đặt chỗ không được đưa lên
              Community.
            </p>
            <div className="sm:col-span-2">
              {previewing ? (
                <div className="flex items-center gap-2 rounded-xl bg-background p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo bản xem
                  trước công khai...
                </div>
              ) : preview ? (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        Bản xem trước sẽ được đăng
                      </p>
                      <h3 className="mt-1 font-black">
                        {preview.snapshot.summary.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {preview.snapshot.summary.destinationName} ·{" "}
                        {preview.snapshot.summary.dayCount} ngày ·{" "}
                        {preview.snapshot.summary.itineraryItemCount} hoạt động
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="mt-3 max-h-52 space-y-3 overflow-y-auto pr-1">
                    {preview.snapshot.days.map((day) => (
                      <div key={day.dayNumber}>
                        <p className="text-xs font-bold text-muted-foreground">
                          Ngày {day.dayNumber}
                          {day.date ? ` · ${day.date}` : ""}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {day.items.map((item) => (
                            <li
                              key={`${day.dayNumber}-${item.order}`}
                              className="text-sm"
                            >
                              <span className="font-bold">
                                {item.order}. {item.title}
                              </span>
                              {item.placeName ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {item.placeName}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {preview.warnings.length > 0 && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                      Ngày/giờ riêng tư hoặc chi tiết nhạy cảm đã được ẩn trong
                      bản công khai.
                    </p>
                  )}
                </div>
              ) : selectedTripId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadPreview(selectedTripId)}
                  className="rounded-full"
                >
                  Tải lại bản xem trước
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {mode === "update" && mediaFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {mediaFiles.map((media, index) => (
              <div
                key={media.previewUrl}
                className="relative aspect-square overflow-hidden rounded-xl bg-muted"
              >
                <Image
                  src={media.previewUrl}
                  alt="Ảnh xem trước"
                  fill
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  disabled={pending}
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"
                  aria-label="Gỡ ảnh"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(error || previewError) && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {previewError || error}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <div>
            {mode === "update" ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  className="rounded-full text-muted-foreground"
                >
                  <ImagePlus className="h-4 w-4" /> {t("social.addPhoto")}
                </Button>
              </>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground">
                {t("social.previewConfirmation")} · {preview?.consentVersion || t("social.pending")}
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={
              pending ||
              previewing ||
              (mode === "update"
                ? !content.trim() && !mediaFiles.length
                : !selectedTripId || !preview)
            }
            className="rounded-full px-5 font-bold cursor-pointer"
          >
            {pending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isUploadingMedia
                  ? "Đang tải ảnh..."
                  : mode === "update"
                    ? "Đang đăng..."
                    : "Đang chia sẻ..."}
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Send className="h-4 w-4" />
                {mode === "update" ? "Đăng cập nhật" : "Xác nhận & chia sẻ"}
              </span>
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}
