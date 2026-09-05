"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth";
import { useCreatePost } from "../hooks";
import type { SocialPost, SocialPostMedia } from "../types";
import { socialPostRepository } from "../services";

interface PostComposerProps {
  onPostCreated?: (newPost: SocialPost) => void;
  className?: string;
}

export function PostComposer({ onPostCreated, className }: PostComposerProps) {
  const { user } = useAuth();
  const { create, submitting, error, feedback, clearError, beginNewDraft } = useCreatePost();

  const [content, setContent] = React.useState("");
  const [mediaFiles, setMediaFiles] = React.useState<Array<{ file: File; previewUrl: string }>>([]);
  const [processingSubmit, setProcessingSubmit] = React.useState(false);
  const submitLockRef = React.useRef(false);
  const mediaFilesRef = React.useRef<Array<{ file: File; previewUrl: string }>>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const authorInitials = React.useMemo(() => {
    if (!user?.name) return user?.email?.slice(0, 2).toUpperCase() || "U";
    const parts = user.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return user.name.slice(0, 2).toUpperCase();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    beginNewDraft();
    Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, 10 - mediaFiles.length)).forEach((file) => {
      setMediaFiles((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }]);
    });

    // Reset input value so same files can be re-selected if needed
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
      body.set("file", file); body.set("api_key", signature.apiKey); body.set("timestamp", String(signature.timestamp)); body.set("signature", signature.signature); body.set("folder", signature.folder); body.set("allowed_formats", signature.allowedFormats.join(","));
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: "POST", body });
      if (!response.ok) throw new Error("Không thể tải ảnh lên. Vui lòng thử lại.");
      const uploaded = await response.json() as { public_id: string; secure_url: string; resource_type: "image"; format: string; width: number; height: number };
      return { publicId: uploaded.public_id, secureUrl: uploaded.secure_url, resourceType: uploaded.resource_type, format: uploaded.format, width: uploaded.width, height: uploaded.height, sortOrder };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) return;
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setProcessingSubmit(true);
    clearError();
    try {
      const newPost = await create({ content: content.trim(), media: await uploadMedia() });

      // Reset form
      setContent("");
      mediaFiles.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setMediaFiles([]);
      onPostCreated?.(newPost);
    } catch {
      // Error handled by useCreatePost hook
    } finally {
      submitLockRef.current = false;
      setProcessingSubmit(false);
    }
  };

  // Auto-grow textarea handler
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    beginNewDraft();
    setContent(e.target.value);
    if (error) clearError();

    // Auto resize
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.max(72, target.scrollHeight)}px`;
  };

  const isSubmitPending = processingSubmit || submitting;
  const isSubmitDisabled = isSubmitPending || (!content.trim() && mediaFiles.length === 0);

  return (
    <div className={`rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs ${className || ""}`}>
      <form onSubmit={handleSubmit}>
        {feedback && (
          <div role="status" aria-live="polite" className={`mb-3 rounded-lg border p-2.5 text-sm ${feedback.variant === "success" ? "border-primary/20 bg-primary text-primary-foreground" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
            {feedback.message}
          </div>
        )}
        {/* Top: Avatar + Textarea */}
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 border border-border shrink-0 mt-0.5">
            <AvatarImage src={user?.avatar} alt={user?.name || "User"} />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
              {authorInitials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              placeholder="Chia sẻ trải nghiệm hoặc hành trình của bạn..."
              className="min-h-[72px] resize-none border-none bg-transparent p-0 text-sm sm:text-base leading-relaxed placeholder:text-muted-foreground focus-visible:ring-0 shadow-none"
              rows={2}
              disabled={isSubmitPending}
              aria-label="Nội dung bài viết"
            />
          </div>
        </div>

        {/* Media Preview Grid */}
        {mediaFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {mediaFiles.map(({ previewUrl }, idx) => (
              <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                <Image
                  src={previewUrl}
                  alt={`Preview ${idx + 1}`}
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveMedia(idx)}
                  disabled={isSubmitPending}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground shadow-xs hover:bg-background transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
          {/* File attachment button */}
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
                    className="h-9 gap-2 rounded-full px-3 text-muted-foreground hover:text-foreground"
                    aria-label="Thêm ảnh"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-xs font-medium hidden sm:inline">Thêm ảnh</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Đính kèm ảnh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
