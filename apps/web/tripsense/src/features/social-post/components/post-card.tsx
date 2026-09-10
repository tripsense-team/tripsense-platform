"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth, UserRole } from "@/features/auth";
import type { SocialPost } from "../types";
import { formatRelativeTime } from "../utils/format-time";
import { PostMediaGallery } from "./post-media-gallery";
import { PostActionsMenu } from "./post-actions-menu";
import { PostActionsBar } from "./post-actions-bar";
import { DeletePostDialog } from "./delete-post-dialog";
import { SharedTripArtifactCard } from "./shared-trip-artifact-card";
import { useDeletePost } from "../hooks";
import { cn } from "@/lib/utils";


interface PostCardProps {
  post: SocialPost;
  onPostDeleted?: (postId: string) => void;
  showDetailLink?: boolean;
  className?: string;
}

function visibilityLabel(visibility?: SocialPost["visibility"]) {
  switch (visibility) {
    case "PRIVATE":
      return "Only me";
    case "UNLISTED":
      return "Community";
    default:
      return "Public";
  }
}

export function PostCard({
  post,
  onPostDeleted,
  showDetailLink = true,
  className,
}: PostCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { remove, deleting } = useDeletePost();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleCommentClick = () => {
    if (showDetailLink) {
      router.push(`/community/posts/${post.id}?focus=comment`);
    } else {
      const el = document.getElementById("comments");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        const input = el.querySelector("textarea");
        input?.focus();
      }
    }
  };


  // Authorization check: User is the post author OR has ROLE_ADMIN (or guest author in dev mode)
  const canDelete = Boolean(
    (user && (user.id === post.author.id || user.role === UserRole.ADMIN)) ||
    (!user && post.author.id === "guest-user")
  );

  const authorInitials = React.useMemo(() => {
    if (!post.author.name) return "U";
    const parts = post.author.name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return post.author.name.slice(0, 2).toUpperCase();
  }, [post.author.name]);

  const handleDeleteConfirm = async () => {
    setDeleteError(null);
    try {
      await remove(post.id);
      setDeleteDialogOpen(false);
      onPostDeleted?.(post.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Xóa bài viết thất bại");
    }
  };

  return (
    <article
      className={cn(
        "group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xs transition-all duration-200 hover:shadow-sm",
        className
      )}
    >
      {/* Header: Author + Timestamp + Actions Menu */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/community/users/${post.author.id}`}
            className="transition-opacity hover:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            aria-label={`Xem bài viết của ${post.author.name}`}
          >
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
                {authorInitials}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div>
            <Link
              href={`/community/users/${post.author.id}`}
              className="text-sm font-semibold text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
            >
              {post.author.name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatRelativeTime(post.createdAt)}</span>
              {post.type === "TRIP_SHARE" && (
                <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] font-bold">
                  {visibilityLabel(post.visibility)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Post Actions Menu (...) */}
        <PostActionsMenu
          postId={post.id}
          canDelete={canDelete}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          showDetailLink={showDetailLink}
        />
      </div>

      {/* Delete error notification if failed */}
      {deleteError && (
        <div className="mb-3 rounded-lg border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
          {deleteError}
        </div>
      )}

      {/* Content */}
      {post.content && showDetailLink ? (
        <Link
          href={`/community/posts/${post.id}`}
          className="block text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-line break-words mb-4 hover:opacity-90 transition-opacity focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded-lg cursor-pointer"
        >
          {post.content}
        </Link>
      ) : post.content ? (
        <div className="text-sm sm:text-base leading-relaxed text-foreground whitespace-pre-line break-words mb-4">
          {post.content}
        </div>
      ) : null}

      {/* Shared trip artifact */}
      {post.type === "TRIP_SHARE" && post.trip && (
        <SharedTripArtifactCard
          trip={post.trip}
          compact={showDetailLink}
          href={`/community/posts/${post.id}`}
        />
      )}

      {/* Media gallery */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mb-3">
          <PostMediaGallery mediaUrls={post.mediaUrls} />
        </div>
      )}

      {/* Post Actions Bar: Like, Comment, Share */}
      <div className="mt-2">
        <PostActionsBar
          postId={post.id}
          initialLiked={post.isLiked}
          initialLikeCount={post.likeCount}
          commentCount={post.commentCount}
          postContent={post.content}
          onCommentClick={handleCommentClick}
        />
      </div>



      {/* Delete confirmation dialog */}
      <DeletePostDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </article>
  );
}
