"use client";

import * as React from "react";
import { MessageSquare, MessageCircleOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentComposer } from "./comment-composer";
import { CommentItem } from "./comment-item";
import { usePostComments } from "../hooks/use-post-comments";
import { cn } from "@/lib/utils";

interface CommentSectionProps {
  postId: string;
  onCommentAdded?: () => void;
  className?: string;
  commentsState?: ReturnType<typeof usePostComments>;
  hideComposer?: boolean;
  focusComment?: boolean;
  onReplyClick?: (parentId: string, authorName: string) => void;
}

export function CommentSection({
  postId,
  onCommentAdded,
  className,
  commentsState: externalCommentsState,
  hideComposer = false,
  focusComment = false,
  onReplyClick,
}: CommentSectionProps) {
  const internalCommentsState = usePostComments(postId);
  const {
    flattenedTree,
    totalCount,
    loading,
    error,
    addComment,
    toggleCommentLike,
  } = externalCommentsState || internalCommentsState;

  const handleCreateRootComment = async (content: string, parentId?: string | null) => {
    await addComment(content, parentId);
    onCommentAdded?.();
  };

  return (
    <section
      id="comments"
      aria-label="Khu vực bình luận"
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6 text-card-foreground shadow-xs space-y-6",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            Bình luận
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCount})
            </span>
          </h2>
        </div>
      </div>

      {/* Primary Comment Composer */}
      {!hideComposer && (
        <div className="pb-2">
          <CommentComposer
            onSubmit={handleCreateRootComment}
            placeholder="Viết bình luận..."
            autoFocus={focusComment}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Comment List */}
      <div className="space-y-4 pt-2">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-2 flex-1 max-w-md">
                  <Skeleton className="h-14 w-full rounded-2xl" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? null : flattenedTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <MessageCircleOff className="h-10 w-10 stroke-[1.5] mb-2 opacity-50" />
            <p className="text-sm font-medium">Chưa có bình luận nào</p>
            <p className="text-xs text-muted-foreground/80 mt-0.5">
              Hãy là người đầu tiên chia sẻ cảm nghĩ về bài viết này!
            </p>
          </div>
        ) : (
          flattenedTree.map((node) => (
            <CommentItem
              key={node.comment.id}
              node={node}
              onLike={toggleCommentLike}
              onReply={async (content, parentId) => {
                await addComment(content, parentId);
                onCommentAdded?.();
              }}
              onReplyClick={onReplyClick}
            />
          ))
        )}
      </div>
    </section>
  );
}
