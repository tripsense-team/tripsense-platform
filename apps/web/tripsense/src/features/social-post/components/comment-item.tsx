"use client";

import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime } from "../utils/format-time";
import { CommentComposer } from "./comment-composer";
import type { FlattenedCommentNode } from "../utils/comment-tree";
import { cn } from "@/lib/utils";

interface CommentItemProps {
  node: FlattenedCommentNode;
  onLike: (commentId: string) => Promise<void>;
  onReply: (content: string, parentId?: string | null) => Promise<void>;
  onReplyClick?: (parentId: string, authorName: string) => void;
  className?: string;
}

export function CommentItem({
  node,
  onLike,
  onReply,
  onReplyClick,
  className,
}: CommentItemProps) {
  const { comment, visualDepth, replyToAuthorName } = node;
  const [isReplying, setIsReplying] = React.useState(false);

  const authorInitials = (() => {
    if (!comment.author.name) return "U";
    const parts = comment.author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return comment.author.name.slice(0, 2).toUpperCase();
  })();


  // Indentation mapping based on visualDepth (strictly clamped to 0, 1, 2)
  const indentClass =
    visualDepth === 0
      ? "ml-0"
      : visualDepth === 1
      ? "ml-5 sm:ml-8 pl-3 border-l-2 border-border/60"
      : "ml-8 sm:ml-14 pl-3 border-l-2 border-border/60";

  return (
    <div className={cn("space-y-2 transition-all", indentClass, className)}>
      <div className="flex items-start gap-2.5 sm:gap-3 group">
        {/* Author Avatar */}
        <Link
          href={`/community/users/${comment.author.id}`}
          className="shrink-0 transition-opacity hover:opacity-85 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-full mt-0.5"
          aria-label={`Xem trang của ${comment.author.name}`}
        >
          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-border">
            <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-[10px] sm:text-xs">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Comment Bubble & Actions */}
        <div className="flex-1 min-w-0">
          <div className="inline-block max-w-full rounded-2xl bg-muted/60 dark:bg-muted/40 px-3.5 py-2.5 sm:px-4 sm:py-3 border border-border/40">
            {/* Header: Name + Timestamp */}
            <div className="flex items-baseline gap-2 flex-wrap mb-1">
              <Link
                href={`/community/users/${comment.author.id}`}
                className="text-xs sm:text-sm font-semibold text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
              >
                {comment.author.name}
              </Link>
              <span className="text-[11px] text-muted-foreground">
                · {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Replying indicator tag if this comment is a reply */}
            {replyToAuthorName && (
              <div className="mb-1 text-xs text-muted-foreground">
                Trả lời{" "}
                <span className="font-semibold text-primary">
                  @{replyToAuthorName}
                </span>
              </div>
            )}

            {/* Comment text */}
            <p className="text-xs sm:text-sm leading-relaxed text-foreground break-words whitespace-pre-line">
              {comment.content}
            </p>
          </div>

          {/* Action Row: Like & Reply */}
          <div className="flex items-center gap-4 mt-1 pl-2 text-xs">
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              className={cn(
                "flex items-center gap-1 font-medium transition-colors hover:underline focus-visible:outline-hidden",
                comment.isLiked
                  ? "text-rose-600 dark:text-rose-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{comment.isLiked ? "Đã thích" : "Thích"}</span>
              {comment.likeCount > 0 && (
                <span className="flex items-center gap-0.5 ml-0.5 text-[11px]">
                  <Heart className="h-3 w-3 fill-current text-rose-500" />
                  <span>{comment.likeCount}</span>
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (onReplyClick) {
                  onReplyClick(comment.id, comment.author.name);
                } else {
                  setIsReplying((prev) => !prev);
                }
              }}
              className="font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-hidden"
            >
              Trả lời
            </button>
          </div>
        </div>
      </div>

      {/* Inline Reply Composer */}
      {isReplying && (
        <div className="pt-2 pl-9 sm:pl-11">
          <CommentComposer
            parentId={comment.id}
            replyToAuthorName={comment.author.name}
            placeholder={`Trả lời ${comment.author.name}...`}
            autoFocus
            onCancelReply={() => setIsReplying(false)}
            onSubmit={async (content, parentId) => {
              await onReply(content, parentId);
              setIsReplying(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
