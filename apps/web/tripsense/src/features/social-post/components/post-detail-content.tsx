"use client";

import * as React from "react";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared";
import { useSocialPost } from "../hooks/use-social-post";
import { usePostComments } from "../hooks/use-post-comments";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { CommentSection } from "./comment-section";
import type { SocialPost } from "../types";

export interface PostDetailContentProps {
  postId: string;
  mode?: "modal" | "page";
  /** Optional pre-fetched or parent-managed commentsState */
  commentsState?: ReturnType<typeof usePostComments>;
  /** Hide the composer in CommentSection (used when modal has its own sticky composer) */
  hideComposer?: boolean;
  /** Callback when user clicks 'Reply' on any comment */
  onReplyClick?: (parentId: string, authorName: string) => void;
  /** Callback when post is deleted */
  onPostDeleted?: () => void;
  /** Callback when close/back is requested */
  onClose?: () => void;
  /** Optional post loaded callback */
  onPostLoaded?: (post: SocialPost) => void;
}

export function PostDetailContent({
  postId,
  mode = "page",
  commentsState,
  hideComposer = false,
  onReplyClick,
  onPostDeleted,
  onClose,
  onPostLoaded,
}: PostDetailContentProps) {
  const { post, loading, error, isNotFound, status, refetch } = useSocialPost(postId);

  React.useEffect(() => {
    if (post && onPostLoaded) {
      onPostLoaded(post);
    }
  }, [post, onPostLoaded]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PostCardSkeleton />
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="h-5 w-32 bg-muted rounded-md animate-pulse" />
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-24 bg-muted rounded-md animate-pulse" />
                  <div className="h-4 w-3/4 bg-muted rounded-md animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Không tìm thấy bài viết"
        description="Bài viết này không tồn tại hoặc đã được tác giả gỡ bỏ."
        action={
          mode === "modal" && onClose ? (
            <Button onClick={onClose} className="rounded-full px-5 text-sm font-semibold">
              Quay lại cộng đồng
            </Button>
          ) : (
            <Button asChild className="rounded-full px-5 text-sm font-semibold">
              <Link href="/community">Quay lại cộng đồng</Link>
            </Button>
          )
        }
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        message={
          status === 401
            ? "Vui lòng đăng nhập để xem bài viết này."
            : status === 403
              ? "Bạn không có quyền xem bài viết này."
              : error
        }
        onRetry={refetch}
      />
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="space-y-6 pb-2">
      <PostCard
        post={post}
        showDetailLink={false}
        onPostDeleted={onPostDeleted}
      />

      <CommentSection
        postId={post.id}
        commentsState={commentsState}
        hideComposer={hideComposer}
        onReplyClick={onReplyClick}
        onCommentAdded={refetch}
      />
    </div>
  );
}
