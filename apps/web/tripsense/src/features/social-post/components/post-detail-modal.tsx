"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePostComments } from "../hooks/use-post-comments";
import { PostDetailContent } from "./post-detail-content";
import { CommentComposer } from "./comment-composer";
import type { SocialPost } from "../types";
import { cn } from "@/lib/utils";

interface PostDetailModalProps {
  postId: string;
  initialFocusComment?: boolean;
}

export function PostDetailModal({
  postId,
  initialFocusComment = false,
}: PostDetailModalProps) {
  const router = useRouter();
  const commentsState = usePostComments(postId);
  const [currentPost, setCurrentPost] = React.useState<SocialPost | null>(null);

  const [replyingTo, setReplyingTo] = React.useState<{
    parentId: string;
    authorName: string;
  } | null>(null);

  const handleClose = () => {
    // If opened from community feed, router.back() preserves community feed scroll and state
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace("/community");
    }
  };

  const handlePostDeleted = () => {
    handleClose();
  };

  const handleCreateComment = async (content: string, parentId?: string | null) => {
    await commentsState.addComment(content, parentId);
    setReplyingTo(null);
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogPrimitive.Portal>
        {/* Dim Overlay with Blur */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
        />

        {/* Modal Window Container */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 bg-background text-foreground shadow-2xl flex flex-col overflow-hidden",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
            // Mobile: Full-height bottom sheet with rounded top corners
            "inset-x-0 bottom-0 top-6 sm:top-auto sm:inset-auto h-[calc(100dvh-1.5rem)] sm:h-[88vh] sm:max-h-[88vh]",
            "w-full sm:w-[94vw] sm:max-w-3xl lg:max-w-4xl",
            "rounded-t-3xl sm:rounded-3xl border-t sm:border border-border",
            // Desktop: Centered modal with smooth 24px rounded corners
            "sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
            "data-[state=open]:sm:zoom-in-95 data-[state=closed]:sm:zoom-out-95"
          )}
        >
          {/* Accessible Dialog Title */}
          <DialogPrimitive.Title className="sr-only">
            {currentPost ? `Bài viết của ${currentPost.author.name}` : "Chi tiết bài viết"}
          </DialogPrimitive.Title>

          {/* Sticky Header */}
          <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border bg-background/95 backdrop-blur-md z-10 shrink-0 rounded-t-3xl">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-9 w-9 rounded-full sm:hidden text-muted-foreground hover:text-foreground"
                aria-label="Quay lại"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Bài viết
              </h2>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Đóng bài viết"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Scrollable Body Container */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 overscroll-contain">
            <PostDetailContent
              postId={postId}
              mode="modal"
              commentsState={commentsState}
              hideComposer={true}
              onReplyClick={(parentId, authorName) => {
                setReplyingTo({ parentId, authorName });
              }}
              onPostDeleted={handlePostDeleted}
              onClose={handleClose}
              onPostLoaded={setCurrentPost}
            />
          </div>

          {/* Sticky Bottom Comment Composer */}
          <footer className="border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-3.5 z-10 shrink-0 sm:rounded-b-3xl">
            <CommentComposer
              parentId={replyingTo?.parentId}
              replyToAuthorName={replyingTo?.authorName}
              onCancelReply={() => setReplyingTo(null)}
              autoFocus={initialFocusComment || !!replyingTo}
              placeholder={
                replyingTo
                  ? `Trả lời @${replyingTo.authorName}...`
                  : "Viết bình luận cho bài viết này..."
              }
              onSubmit={handleCreateComment}
            />
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
