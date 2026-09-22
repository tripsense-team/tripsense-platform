"use client";

import * as React from "react";
import { Send, Loader2, X, CornerDownRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth";
import { useUserProfile } from "@/features/profile";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

interface CommentComposerProps {
  onSubmit: (content: string, parentId?: string | null) => Promise<void>;
  parentId?: string | null;
  replyToAuthorName?: string;
  onCancelReply?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function CommentComposer({
  onSubmit,
  parentId,
  replyToAuthorName,
  onCancelReply,
  placeholder,
  autoFocus = false,
  className,
}: CommentComposerProps) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder || t("social.commentPlaceholder");
  const { user } = useAuth();
  const { data: userProfile } = useUserProfile(user?.id || "");
  const authorAvatar = userProfile?.avatarUrl || user?.avatar;
  const displayName = userProfile?.email
    ? userProfile.email.split("@")[0] || user?.name
    : user?.name;

  const [content, setContent] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, parentId]);

  const userInitials = (() => {
    if (!displayName) return user?.email?.slice(0, 2).toUpperCase() || "U";
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  })();

  const isSubmittingRef = React.useRef(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed, parentId);
      setContent("");
      if (onCancelReply) {
        onCancelReply();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Replying banner indicator */}
      {replyToAuthorName && (
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5 text-primary" />
            <span>{t("social.replyingTo", { name: replyToAuthorName })}</span>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={t("common.cancel")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2.5 sm:gap-3 items-start"
      >
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-0.5">
          <AvatarImage
            src={authorAvatar}
            alt={displayName || t("common.guestUser")}
          />
          <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
            {userInitials}
          </AvatarFallback>
        </Avatar>

        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              replyToAuthorName
                ? t("social.replyingTo", { name: replyToAuthorName }) + "..."
                : effectivePlaceholder
            }
            disabled={submitting}
            rows={1}
            className="min-h-[42px] max-h-[160px] resize-none rounded-xl bg-muted/40 py-2.5 pl-3.5 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring border border-border"
          />

          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || submitting}
            className="absolute right-1.5 top-1.5 h-7 w-7 rounded-lg transition-all cursor-pointer"
            aria-label={t("social.send")}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </form>

      {/* Error message */}
      {error && <p className="text-xs text-destructive pl-11">{error}</p>}
    </div>
  );
}
