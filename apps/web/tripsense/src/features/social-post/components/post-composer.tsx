"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Compass, Loader2, X, Send, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth";
import { useUserProfile } from "@/features/profile";
import { useCreatePost } from "../hooks";
import type { SocialPost, SocialPostMedia, SharedTripSummary } from "../types";
import { socialPostRepository } from "../services";
import { listTrips } from "@/features/trip-management/services/trip-management-api";
import type { TripResponse } from "@/features/trip-management/types";
import { formatContentWithTrip } from "../utils/parse-trip-metadata";
import { SharedTripCard } from "./shared-trip-card";

interface PostComposerProps {
  onPostCreated?: (newPost: SocialPost) => void;
  className?: string;
}

export function PostComposer({ onPostCreated, className }: PostComposerProps) {
  const { user } = useAuth();
  const { create, submitting, error, feedback, dismissFeedback, clearError, beginNewDraft } = useCreatePost();

  const { data: userProfile } = useUserProfile(user?.id || "");
  const authorAvatar = userProfile?.avatarUrl || user?.avatar;
  const displayName = userProfile?.email ? (userProfile.email.split("@")[0] || user?.name) : user?.name;

  const [content, setContent] = React.useState("");
  const [mediaFiles, setMediaFiles] = React.useState<Array<{ file: File; previewUrl: string }>>([]);
  const [selectedTrip, setSelectedTrip] = React.useState<SharedTripSummary | null>(null);
  const [userTrips, setUserTrips] = React.useState<SharedTripSummary[]>([]);
  const [loadingTrips, setLoadingTrips] = React.useState(false);
  const [processingSubmit, setProcessingSubmit] = React.useState(false);
  const submitLockRef = React.useRef(false);
  const mediaFilesRef = React.useRef<Array<{ file: File; previewUrl: string }>>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Fetch real trips from My Trips
  const fetchUserTrips = React.useCallback(async () => {
    setLoadingTrips(true);
    try {
      const response = await listTrips({ size: 20 });
      const rawTrips: TripResponse[] = response.content || [];
      const mapped: SharedTripSummary[] = rawTrips.map((t) => ({
        id: t.id,
        name: t.name,
        destinationName: t.destinationName,
        startDate: t.startDate,
        endDate: t.endDate,
        coverImageUrl: t.coverImageUrl || undefined,
        budgetAmount: t.budgetAmount || undefined,
        budgetCurrency: t.budgetCurrency || undefined,
      }));
      setUserTrips(mapped);
    } catch {
      // Fallback empty if not logged in or network error
      setUserTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }, []);

  const authorInitials = React.useMemo(() => {
    if (!displayName) return user?.email?.slice(0, 2).toUpperCase() || "U";
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [user, displayName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    beginNewDraft();
    Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 10 - mediaFiles.length)).forEach((file) => {
      setMediaFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    });

    e.target.value = "";
  };

  const handleRemoveMedia = (index: number) => {
    beginNewDraft();
    setMediaFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  React.useEffect(() => { mediaFilesRef.current = mediaFiles; }, [mediaFiles]);
  React.useEffect(() => () => mediaFilesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl)), []);

  const uploadMedia = async (): Promise<SocialPostMedia[]> => {
    if (mediaFiles.length === 0) return [];
    if (process.env.NEXT_PUBLIC_USE_SOCIAL_POST_MOCK === "true") {
      return mediaFiles.map(({ file, previewUrl }, sortOrder) => ({ publicId: `mock/${file.name}`, secureUrl: previewUrl, resourceType: "image", format: file.type.split("/")[1] || "jpg", width: 1, height: 1, sortOrder }));
    }
    const signature = await socialPostRepository.getUploadSignature();
    return Promise.all(mediaFiles.map(async ({ file }, sortOrder) => {
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", signature.apiKey);
      body.set("timestamp", String(signature.timestamp));
      body.set("signature", signature.signature);
      body.set("folder", signature.folder);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: "POST", body });
      if (!response.ok) throw new Error("Upload ảnh thất bại.");
      const data = await response.json();
      return { publicId: data.public_id, secureUrl: data.secure_url, resourceType: "image" as const, format: data.format, width: data.width, height: data.height, sortOrder };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0 && !selectedTrip) return;
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setProcessingSubmit(true);
    clearError();
    try {
      const payloadContent = formatContentWithTrip(content, selectedTrip);
      const createdPost = await create({ content: payloadContent, media: await uploadMedia() });
      
      // Enrich with attached trip if selected (TF-65)
      const postWithTrip: SocialPost = {
        ...createdPost,
        tripId: selectedTrip?.id,
        tripSummary: selectedTrip || undefined,
      };

      // Reset form
      setContent("");
      setSelectedTrip(null);
      mediaFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setMediaFiles([]);
      onPostCreated?.(postWithTrip);
    } catch {
      // Error handled by useCreatePost hook
    } finally {
      submitLockRef.current = false;
      setProcessingSubmit(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    beginNewDraft();
    setContent(e.target.value);
    if (error) clearError();

    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.max(72, target.scrollHeight)}px`;
  };

  const isSubmitPending = processingSubmit || submitting;
  const isSubmitDisabled = isSubmitPending || (!content.trim() && mediaFiles.length === 0 && !selectedTrip);

  return (
    <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs ${className || ""}`}>
      <form onSubmit={handleSubmit}>
        {/* Floating Top-Right Toast Notification */}
        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className="fixed top-6 right-6 z-[100] flex max-w-sm sm:max-w-md items-center gap-3 rounded-2xl border border-border/80 bg-background/95 p-3.5 pr-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 sm:slide-in-from-right-4 duration-300"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                feedback.variant === "success"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/15 text-destructive"
              }`}
            >
              {feedback.variant === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-bold text-foreground">
                {feedback.variant === "success" ? "Đăng bài thành công" : "Không thể đăng bài"}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                {feedback.variant === "success"
                  ? "Bài viết của bạn đã được chia sẻ lên cộng đồng."
                  : feedback.message}
              </p>
            </div>

            <button
              type="button"
              onClick={dismissFeedback}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {/* Top: Avatar + Textarea */}
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 border border-border shrink-0 mt-0.5">
            <AvatarImage src={authorAvatar} alt={displayName || "User"} />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
              {authorInitials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Chia sẻ khoảnh khắc, cảm nhận hoặc lịch trình du lịch của bạn..."
              disabled={isSubmitPending}
              className="min-h-[72px] resize-none border-0 bg-transparent p-0 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-sm sm:text-base leading-relaxed shadow-none"
              maxLength={5000}
            />
          </div>
        </div>

        {/* Attached Trip Preview in Composer (TF-65) */}
        {selectedTrip && (
          <div className="relative mt-3 rounded-2xl overflow-hidden border border-primary/30">
            <button
              type="button"
              onClick={() => setSelectedTrip(null)}
              className="absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black transition-colors"
              aria-label="Gỡ chuyến đi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <SharedTripCard trip={selectedTrip} isCompact />
          </div>
        )}

        {/* Media Preview Grid */}
        {mediaFiles.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
            {mediaFiles.map((media, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-muted group/media">
                <Image src={media.previewUrl} alt="Preview" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black transition-colors opacity-90 group-hover/media:opacity-100"
                  aria-label="Gỡ ảnh"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isSubmitPending}
            />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitPending}
                    className="h-9 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground"
                    aria-label="Thêm ảnh"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-xs font-medium hidden sm:inline">Ảnh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Đính kèm ảnh</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Attach Trip Dropdown (TF-65) */}
            <DropdownMenu onOpenChange={(open) => open && fetchUserTrips()}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={selectedTrip ? "secondary" : "ghost"}
                  size="sm"
                  disabled={isSubmitPending}
                  className={`h-9 gap-1.5 rounded-full px-3 text-xs font-medium ${selectedTrip ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Compass className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {selectedTrip ? "Đã đính kèm hành trình" : "Đính kèm hành trình"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80">
                <DropdownMenuLabel className="text-xs font-semibold flex items-center justify-between">
                  <span>Chuyến đi từ My Trips của bạn</span>
                  {loadingTrips && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {loadingTrips ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Đang tải danh sách chuyến đi...
                  </div>
                ) : userTrips.length > 0 ? (
                  userTrips.map((trip) => (
                    <DropdownMenuItem
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                    >
                      <span className="font-semibold text-xs line-clamp-1">{trip.name}</span>
                      <span className="text-[11px] text-muted-foreground">{trip.destinationName}</span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="p-3 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Bạn chưa có chuyến đi nào trong My Trips.</p>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-full gap-1">
                      <Link href="/trips/new">
                        <Plus className="h-3 w-3" />
                        Tạo chuyến đi mới
                      </Link>
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isSubmitDisabled}
            className="h-9 rounded-full px-5 text-sm font-semibold gap-1.5 shadow-xs"
          >
            {isSubmitPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang đăng...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Đăng bài</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
