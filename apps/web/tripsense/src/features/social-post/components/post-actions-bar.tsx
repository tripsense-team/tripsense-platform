"use client";

import * as React from "react";
import { Heart, MessageCircle, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostLike } from "../hooks/use-post-like";
import { cn } from "@/lib/utils";

interface PostActionsBarProps {
  postId: string;
  initialLiked?: boolean;
  initialLikeCount?: number;
  commentCount?: number;
  postContent?: string;
  onCommentClick?: () => void;
  onLikeChanged?: (liked: boolean, count: number) => void;
  className?: string;
}

export function PostActionsBar({
  postId,
  initialLiked = false,
  initialLikeCount = 0,
  commentCount = 0,
  postContent,
  onCommentClick,
  onLikeChanged,
  className,
}: PostActionsBarProps) {
  const { isLiked, likeCount, isPending, error, toggleLike } = usePostLike({
    postId,
    initialLiked,
    initialCount: initialLikeCount,
    onLikeChanged,
  });

  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    const postUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/community/posts/${postId}`
        : "";

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Bài viết trên TripSense",
          text: postContent ? postContent.slice(0, 100) : "Khám phá bài viết thú vị trên TripSense Community!",
          url: postUrl,
        });
        return;
      } catch {
        // Fallback to clipboard if user dismissed share sheet or unsupported
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(postUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard write error
      }
    }
  };

  const hasStats = likeCount > 0 || commentCount > 0;

  return (
    <div className={cn("w-full pt-1 select-none", className)}>
      {/* Counters row: Likes & Comments count */}
      {hasStats && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-2">
          <div className="flex items-center gap-1.5">
            {likeCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <Heart className="h-2.5 w-2.5 fill-current" />
                </span>
                <span className="font-medium text-foreground">{likeCount}</span>{" "}
                <span>lượt thích</span>
              </span>
            )}
          </div>

          <div>
            {commentCount > 0 && (
              <button
                type="button"
                onClick={onCommentClick}
                className="hover:underline cursor-pointer focus-visible:outline-hidden"
              >
                <span className="font-medium text-foreground">{commentCount}</span>{" "}
                <span>bình luận</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error alert if like toggle failed */}
      {error && (
        <p className="px-1 pb-2 text-xs text-destructive">{error}</p>
      )}

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Action buttons: Like, Comment, Share */}
      <div className="grid grid-cols-3 gap-1 pt-1.5">
        {/* Like Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          disabled={isPending}
          className={cn(
            "flex items-center justify-center gap-2 h-9 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring active:scale-95",
            isLiked
              ? "text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={isLiked ? "Bỏ thích bài viết" : "Thích bài viết"}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isLiked ? "fill-current scale-110" : ""
            )}
          />
          <span>{isLiked ? "Đã thích" : "Thích"}</span>
        </Button>

        {/* Comment Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCommentClick}
          className="flex items-center justify-center gap-2 h-9 rounded-lg font-medium text-xs sm:text-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring active:scale-95 transition-all duration-200"
          aria-label="Bình luận bài viết"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Bình luận</span>
        </Button>

        {/* Share Button (External sharing only) */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className={cn(
            "flex items-center justify-center gap-2 h-9 rounded-lg font-medium text-xs sm:text-sm hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring active:scale-95 transition-all duration-200",
            copied
              ? "text-emerald-600 dark:text-emerald-400 font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label="Chia sẻ bài viết"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Đã chép link</span>
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              <span>Chia sẻ</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
